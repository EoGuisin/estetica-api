import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateAssessmentInput,
} from "../schemas/anamnesis.schema";

export class AnamnesisService {
  private static async createQuestionWithSubQuestions(
    tx: Prisma.TransactionClient,
    sectionId: string,
    questionData: any,
    parentQuestionId: string | null
  ) {
    const { subQuestions, ...question } = questionData;

    const createdQuestion = await tx.anamnesisQuestion.create({
      data: {
        ...question,
        sectionId,
        parentQuestionId,
        options: question.options ? question.options : undefined,
      },
    });

    if (subQuestions && subQuestions.length > 0) {
      for (const subQuestion of subQuestions) {
        await this.createQuestionWithSubQuestions(
          tx,
          sectionId,
          subQuestion,
          createdQuestion.id
        );
      }
    }

    return createdQuestion;
  }

  static async createTemplate(clinicId: string, data: CreateTemplateInput) {
    const { sections, ...templateData } = data;

    return prisma.$transaction(async (tx) => {
      const template = await tx.anamnesisTemplate.create({
        data: {
          ...templateData,
          clinicId,
        },
      });

      for (const section of sections) {
        const { questions, ...sectionData } = section;

        const createdSection = await tx.anamnesisSection.create({
          data: {
            ...sectionData,
            templateId: template.id,
          },
        });

        for (const question of questions) {
          await this.createQuestionWithSubQuestions(
            tx,
            createdSection.id,
            question,
            null
          );
        }
      }

      return template;
    });
  }

  static async listTemplates(clinicId: string) {
    return prisma.anamnesisTemplate.findMany({
      where: { clinicId },
      include: {
        _count: {
          select: {
            sections: true,
            assessments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getTemplateById(id: string, clinicId: string) {
    const template = await prisma.anamnesisTemplate.findFirst({
      where: { id, clinicId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              where: { parentQuestionId: null },
              orderBy: { order: "asc" },
              include: {
                subQuestions: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!template) return null;

    const nestSubQuestions = (questions: any[]): any[] => {
      return questions.map((q) => ({
        ...q,
        subQuestions: q.subQuestions ? nestSubQuestions(q.subQuestions) : [],
      }));
    };

    template.sections.forEach((section) => {
      section.questions = nestSubQuestions(section.questions);
    });

    return template;
  }

  static async updateTemplate(
    id: string,
    clinicId: string,
    data: UpdateTemplateInput
  ) {
    // 1. Buscamos o template e verificamos se ele já foi usado
    const template = await prisma.anamnesisTemplate.findFirst({
      where: { id, clinicId },
      include: {
        _count: {
          select: { assessments: true },
        },
      },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    const { sections, ...templateData } = data;
    const hasAssessments = template._count.assessments > 0;

    if (hasAssessments && sections) {
      return prisma.$transaction(async (tx) => {
        await tx.anamnesisTemplate.update({
          where: { id },
          data: {
            isActive: false,
            name: `${
              template.name
            } (Versão anterior - ${new Date().toLocaleDateString("pt-BR")})`,
          },
        });

        // B. Cria o NOVO template (A nova versão ativa)
        const newTemplate = await tx.anamnesisTemplate.create({
          data: {
            name: templateData.name || template.name,
            description: templateData.description ?? template.description,
            isActive: templateData.isActive ?? true, // O novo nasce ativo (ou conforme o form)
            clinicId,
          },
        });

        // C. Recria as seções e perguntas no NOVO template
        for (const section of sections) {
          const { questions, ...sectionData } = section;

          const createdSection = await tx.anamnesisSection.create({
            data: {
              title: sectionData.title,
              order: sectionData.order,
              templateId: newTemplate.id, // Vincula ao NOVO ID
            },
          });

          for (const question of questions) {
            await this.createQuestionWithSubQuestions(
              tx,
              createdSection.id,
              question,
              null
            );
          }
        }

        return newTemplate; // Retorna o novo objeto
      });
    }

    // 3. Se NÃO foi usado AINDA, ou se não estamos mexendo na estrutura (só renomeando),
    // podemos usar a lógica antiga de substituir (Safe Update ou Overwrite)

    return prisma.$transaction(async (tx) => {
      // Atualiza dados básicos
      const updatedTemplate = await tx.anamnesisTemplate.update({
        where: { id },
        data: templateData,
      });

      // Se enviou seções novas e NÃO tem uso, podemos apagar e recriar (lógica antiga)
      if (sections && !hasAssessments) {
        // Aqui é seguro fazer deleteMany pois não tem AssessmentResponse vinculado
        await tx.anamnesisSection.deleteMany({
          where: { templateId: id },
        });

        for (const section of sections) {
          const { questions, ...sectionData } = section;

          const createdSection = await tx.anamnesisSection.create({
            data: {
              ...sectionData,
              templateId: id,
            },
          });

          for (const question of questions) {
            await this.createQuestionWithSubQuestions(
              tx,
              createdSection.id,
              question,
              null
            );
          }
        }
      }

      return updatedTemplate;
    });
  }

  static async deleteTemplate(id: string, clinicId: string) {
    const template = await prisma.anamnesisTemplate.findFirst({
      where: { id, clinicId },
      include: {
        _count: {
          select: { assessments: true },
        },
      },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    if (template._count.assessments > 0) {
      throw new Error("Cannot delete template with existing assessments");
    }

    return prisma.anamnesisTemplate.delete({
      where: { id },
    });
  }

  private static mapQuestionForDuplication(question: any): any {
    return {
      question: question.question,
      description: question.description,
      type: question.type,
      isRequired: question.isRequired,
      order: question.order,
      options: question.options,
      showCondition: question.showCondition,
      subQuestions:
        question.subQuestions?.map((sq: any) =>
          this.mapQuestionForDuplication(sq)
        ) || [],
    };
  }

  static async duplicateTemplate(id: string, clinicId: string) {
    const originalTemplate = await this.getTemplateById(id, clinicId);

    if (!originalTemplate) {
      throw new Error("Template not found");
    }

    const templateData = {
      name: `${originalTemplate.name} (Cópia)`,
      description: originalTemplate.description,
      isActive: originalTemplate.isActive,
      sections: originalTemplate.sections.map((section) => ({
        title: section.title,
        order: section.order,
        questions: section.questions.map((question) =>
          this.mapQuestionForDuplication(question)
        ),
      })),
    };

    return this.createTemplate(clinicId, templateData as CreateTemplateInput);
  }

  static async createOrUpdateAssessment(
    appointmentId: string,
    professionalId: string,
    clinicId: string,
    data: CreateAssessmentInput
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    return prisma.patientAssessment.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        patientId: appointment.patientId,
        templateId: data.templateId,
        professionalId,
        clinicId,
        status: data.status,
        completedAt: data.status === "COMPLETED" ? new Date() : null,
        responses: {
          create: Object.entries(data.responses).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        },
      },
      update: {
        status: data.status,
        completedAt: data.status === "COMPLETED" ? new Date() : null,
        responses: {
          deleteMany: {},
          create: Object.entries(data.responses).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        },
      },
    });
  }

  static async getAssessmentByAppointment(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        appointmentType: true,
        professional: true,
        assessment: {
          include: {
            template: {
              include: {
                sections: {
                  include: {
                    questions: {
                      where: { parentQuestionId: null },
                      orderBy: { order: "asc" },
                      include: {
                        subQuestions: true,
                      },
                    },
                  },
                  orderBy: { order: "asc" },
                },
              },
            },
            responses: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const responsesMap = appointment.assessment
      ? appointment.assessment.responses.reduce((acc, response) => {
          acc[response.questionId] = response.value;
          return acc;
        }, {} as Record<string, any>)
      : {};

    let template = appointment.assessment?.template;
    if (!template) {
      // CORREÇÃO: Pegamos o clinicId do PACIENTE, não do profissional
      const clinicId = appointment.patient.clinicId;

      if (clinicId) {
        const foundTemplate = await prisma.anamnesisTemplate.findFirst({
          where: {
            clinicId: clinicId,
            isActive: true,
          },
          include: {
            sections: {
              orderBy: { order: "asc" },
              include: {
                questions: {
                  where: { parentQuestionId: null },
                  orderBy: { order: "asc" },
                  include: {
                    subQuestions: true,
                  },
                },
              },
            },
          },
        });
        template = foundTemplate ?? undefined;
      }
    }

    return {
      id: appointment.assessment?.id,
      status: appointment.assessment?.status,
      patient: appointment.patient,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        appointmentType: appointment.appointmentType,
        professional: appointment.professional,
      },
      template,
      responses: responsesMap,
    };
  }

  static async listPatientAssessments(patientId: string) {
    return prisma.patientAssessment.findMany({
      where: { patientId },
      include: {
        appointment: {
          select: {
            id: true,
            date: true,
            appointmentType: { select: { name: true } },
            professional: { select: { fullName: true } },
          },
        },
        template: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getAssessmentById(id: string) {
    const assessment = await prisma.patientAssessment.findUnique({
      where: { id },
      include: {
        template: { select: { name: true } },
        responses: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!assessment) return null;

    const allQuestions = await prisma.anamnesisQuestion.findMany({
      where: {
        section: {
          templateId: assessment.templateId,
        },
      },
      orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
    });

    return {
      ...assessment,
      allQuestions,
    };
  }
}
