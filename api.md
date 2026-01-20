# account.service.ts

```ts
// src/services/account.service.ts
import { prisma } from "../lib/prisma";
import { CreateClinicInput } from "../schemas/account.schema";

export class AccountService {
  /**
   * Lista todas as clínicas que pertencem a uma conta.
   */
  static async listClinics(accountId: string) {
    return prisma.clinic.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Busca os detalhes da assinatura da conta.
   */
  static async getSubscription(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        subscription: {
          include: {
            plan: true, // Inclui os detalhes do plano (limite, etc.)
          },
        },
      },
    });
    return account?.subscription || null;
  }

  /**
   * Cria uma nova clínica, mas antes verifica o limite do plano.
   */
  static async createClinic(accountId: string, data: CreateClinicInput) {
    // 1. Verificar se o CNPJ já existe em *qualquer* clínica
    const existingClinic = await prisma.clinic.findUnique({
      where: { taxId: data.taxId },
    });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    // 2. Buscar a conta, o plano e o N° de clínicas atuais
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        _count: { select: { clinics: true } },
        subscription: { include: { plan: true } },
      },
    });

    if (!account) {
      throw new Error("Conta não encontrada."); // Erro de servidor
    }
    if (!account.subscription || !account.subscription.plan) {
      throw {
        code: "PAYMENT_REQUIRED",
        message: "Nenhum plano de assinatura ativo.",
      };
    }

    // 3. Verificar o limite
    const currentClinics = account._count.clinics;
    const clinicLimit = account.subscription.plan.clinicLimit;

    // (Use 0 ou -1 para ilimitado, se desejar)
    if (clinicLimit > 0 && currentClinics >= clinicLimit) {
      throw {
        code: "FORBIDDEN",
        message: `Limite de ${clinicLimit} clínicas atingido. Faça upgrade do seu plano.`,
      };
    }

    // 4. Tudo certo, criar a clínica
    return prisma.clinic.create({
      data: {
        ...data,
        accountId: accountId,
        status: "ACTIVE", // Ou PENDING_PAYMENT, dependendo da sua regra
      },
    });
  }
}

```

# anamnesis.service.ts

```ts
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
      const clinicId = appointment.professional.clinicId;

      // Verificamos se existe um clinicId válido antes de buscar
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
        // Se encontrou, atribui. Se não, continua undefined.
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

```

# appointment.service.ts

```ts
import { prisma } from "../lib/prisma";
import { CreateAppointmentInput } from "../schemas/appointment.schema";
import { format, getDay } from "date-fns"; // Importei getDay
import { ptBR } from "date-fns/locale";

// Custom Error classes
class SessionLimitError extends Error {
  scheduledDates: string[];
  constructor(message: string, scheduledDates: string[]) {
    super(message);
    this.name = "SessionLimitError";
    this.scheduledDates = scheduledDates;
  }
}

// Novo erro para conflitos de agenda
class SchedulingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulingError";
  }
}

// Mapa para converter o número do dia (0-6) para a string do banco
const DAY_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export class AppointmentService {
  static async updateStatus(
    appointmentId: string,
    status:
      | "SCHEDULED"
      | "CONFIRMED"
      | "CANCELED"
      | "COMPLETED"
      | "IN_PROGRESS"
      | "WAITING"
  ) {
    return prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status },
        select: {
          treatmentPlanProcedureId: true,
          treatmentPlanId: true,
        },
      });

      if (updatedAppointment.treatmentPlanProcedureId) {
        const realCompletedCount = await tx.appointment.count({
          where: {
            treatmentPlanProcedureId:
              updatedAppointment.treatmentPlanProcedureId,
            status: "COMPLETED",
          },
        });

        await tx.treatmentPlanProcedure.update({
          where: { id: updatedAppointment.treatmentPlanProcedureId },
          data: { completedSessions: realCompletedCount },
        });
      }

      return updatedAppointment;
    });
  }

  static async create(clinicId: string, data: CreateAppointmentInput) {
    // ---------------------------------------------------------
    // 1. BUSCAR DADOS DO PROFISSIONAL E AGENDA
    // ---------------------------------------------------------
    const professional = await prisma.user.findUniqueOrThrow({
      where: { id: data.professionalId },
      select: {
        fullName: true,
        workingDays: true,
        scheduleStartHour: true,
        scheduleEndHour: true,
      },
    });

    const appointmentDate = new Date(data.date);
    // Ajuste de fuso horário simples para garantir que pegamos o dia certo
    // Adiciona 12h para evitar problemas de meia-noite caindo no dia anterior devido a timezone
    const dateForCheck = new Date(data.date + "T12:00:00");

    // ---------------------------------------------------------
    // 2. VALIDAÇÃO DE DIA DE FUNCIONAMENTO
    // ---------------------------------------------------------
    const dayOfWeekNumber = getDay(dateForCheck); // 0 = Domingo, 1 = Segunda...
    const dayOfWeekString = DAY_MAP[dayOfWeekNumber];

    if (!professional.workingDays.includes(dayOfWeekString)) {
      const diasTraduzidos = {
        SUNDAY: "Domingo",
        MONDAY: "Segunda",
        TUESDAY: "Terça",
        WEDNESDAY: "Quarta",
        THURSDAY: "Quinta",
        FRIDAY: "Sexta",
        SATURDAY: "Sábado",
      };

      throw new SchedulingError(
        `O profissional ${
          professional.fullName
        } não atende neste dia da semana (${
          diasTraduzidos[dayOfWeekString as keyof typeof diasTraduzidos]
        }).`
      );
    }

    // ---------------------------------------------------------
    // 3. VALIDAÇÃO DE HORÁRIO DE EXPEDIENTE
    // ---------------------------------------------------------
    if (professional.scheduleStartHour && professional.scheduleEndHour) {
      // Comparação de string HH:MM funciona bem (ex: "09:00" > "08:00")
      if (
        data.startTime < professional.scheduleStartHour ||
        data.endTime > professional.scheduleEndHour
      ) {
        throw new SchedulingError(
          `Horário fora do expediente do profissional (${professional.scheduleStartHour} às ${professional.scheduleEndHour}).`
        );
      }
    }

    // ---------------------------------------------------------
    // 4. VALIDAÇÃO DE CONFLITO DE HORÁRIO (OVERLAP)
    // ---------------------------------------------------------
    // Busca agendamentos do profissional no MESMO dia que não estejam cancelados
    const conflicts = await prisma.appointment.findMany({
      where: {
        professionalId: data.professionalId,
        date: appointmentDate, // Prisma compara data exata (YYYY-MM-DDT00:00:00.000Z) se o campo for DateTime
        status: { not: "CANCELED" },
      },
      select: { startTime: true, endTime: true },
    });

    const hasOverlap = conflicts.some((existing) => {
      // Lógica de colisão de horário:
      // (NovoInicio < ExistenteFim) E (NovoFim > ExistenteInicio)
      return (
        data.startTime < existing.endTime && data.endTime > existing.startTime
      );
    });

    if (hasOverlap) {
      throw new SchedulingError(
        "Já existe um agendamento para este profissional neste horário."
      );
    }

    // ---------------------------------------------------------
    // 5. VALIDAÇÃO DE LIMITE DE SESSÕES (Sua lógica existente)
    // ---------------------------------------------------------
    if (data.treatmentPlanProcedureId) {
      const planItem = await prisma.treatmentPlanProcedure.findUnique({
        where: { id: data.treatmentPlanProcedureId },
      });

      if (planItem) {
        const existingAppointments = await prisma.appointment.findMany({
          where: {
            treatmentPlanProcedureId: data.treatmentPlanProcedureId,
            NOT: { status: "CANCELED" },
          },
          select: { date: true, startTime: true },
        });

        if (existingAppointments.length >= planItem.contractedSessions) {
          const scheduledDates = existingAppointments.map((apt) =>
            format(new Date(apt.date), "dd/MM/yyyy", { locale: ptBR })
          );

          throw new SessionLimitError(
            `Todas as ${planItem.contractedSessions} sessões contratadas já foram agendadas.`,
            scheduledDates
          );
        }
      }
    }

    // ---------------------------------------------------------
    // 6. CRIAÇÃO DO AGENDAMENTO
    // ---------------------------------------------------------
    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        professionalId: data.professionalId,
        appointmentTypeId: data.appointmentTypeId,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
        date: appointmentDate,
        treatmentPlanId: data.treatmentPlanId,
        treatmentPlanProcedureId: data.treatmentPlanProcedureId,
      },
    });

    return appointment;
  }

  // ... (restante dos métodos listPatients, etc. mantidos iguais)
  static async listPatients(clinicId: string) {
    return prisma.patient.findMany({
      where: { clinicId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  static async listAppointmentTypes() {
    return prisma.appointmentType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  static async listTreatmentPlansByPatient(
    clinicId: string,
    patientId: string
  ) {
    return prisma.treatmentPlan.findMany({
      where: { clinicId, patientId },
      include: {
        procedures: {
          include: { procedure: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

```

# attendance.service.ts

```ts
import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import { randomUUID } from "node:crypto";
import {
  saveAttachmentSchema,
  saveBeforeAfterSchema,
} from "../schemas/attendance.schema";
import { z } from "zod";
import { DocumentType } from "@prisma/client";
import { substituteVariables } from "../lib/templateVariables";
import PdfService from "./pdf.service";

const ATTACHMENTS_BUCKET = "attachments";
const BEFORE_AFTER_BUCKET = "before-after";
const DOCUMENTS_BUCKET = "documents";
const SIGNATURES_BUCKET = "signatures";

export class AttendanceService {
  static async checkStorageLimit(clinicId: string, newFileSize: number) {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        storageUsed: true,
        account: {
          select: {
            subscription: {
              select: { currentMaxStorage: true, status: true },
            },
          },
        },
      },
    });

    const subscription = clinic.account.subscription;

    if (!subscription || subscription.status !== "active") {
      throw new Error("Assinatura inativa ou inexistente.");
    }

    const currentUsed = clinic.storageUsed;
    const sizeToAdd = BigInt(newFileSize);
    const limit = subscription.currentMaxStorage;

    if (currentUsed + sizeToAdd > limit) {
      throw new Error(
        "Limite de armazenamento excedido (10GB). Faça um upgrade para continuar enviando arquivos."
      );
    }

    return true;
  }

  static async getTemplatesForPatient(
    patientId: string,
    type: DocumentType,
    clinicIdFromRequest?: string
  ): Promise<any[]> {
    // 1. Busca o paciente e seus planos para descobrir QUAIS especialidades ele usa
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      include: {
        treatmentPlans: {
          include: {
            procedures: {
              include: {
                procedure: true, // Para pegar o specialtyId
              },
            },
          },
          // Pega todos os planos da clínica atual para varrer as especialidades
          where: { clinicId: clinicIdFromRequest },
        },
      },
    });

    // Define qual Clinic ID usar (preferência para o do request)
    const targetClinicId = clinicIdFromRequest || patient.clinicId;

    // 2. Extrai IDs únicos das especialidades dos procedimentos do paciente
    const specialtyIds = new Set<string>();

    patient.treatmentPlans.forEach((plan) => {
      plan.procedures.forEach((proc) => {
        if (proc.procedure?.specialtyId) {
          specialtyIds.add(proc.procedure.specialtyId);
        }
      });
    });

    // Se o paciente não tem planos/procedimentos, não mostramos templates (ou mostramos todos da clínica?)
    // Regra: Se não tem especialidade definida, não mostra nada para evitar erro.
    if (specialtyIds.size === 0) {
      return [];
    }

    // 3. Busca templates filtrando:
    // - Pela CLÍNICA ATUAL (Isolamento)
    // - Pelo TIPO (Contrato/Termo)
    // - Pelas ESPECIALIDADES que o paciente tem
    const templates = await prisma.specialtyTemplate.findMany({
      where: {
        clinicId: targetClinicId, // <--- ISOLAMENTO GARANTIDO
        type: type,
        isActive: true,
        specialtyId: {
          in: Array.from(specialtyIds), // <--- APENAS ESPECIALIDADES DO PACIENTE
        },
      },
      include: {
        specialty: { select: { name: true } }, // Para mostrar no front de qual especialidade é
      },
      orderBy: { name: "asc" },
    });

    return templates;
  }

  static async generateDocumentFromTemplate(data: {
    patientId: string;
    templateId: string;
    clinicId: string;
    professionalId: string;
  }) {
    if (!data.professionalId) {
      throw new Error("ID do profissional é obrigatório.");
    }

    const template = await prisma.specialtyTemplate.findUniqueOrThrow({
      where: { id: data.templateId },
      include: { specialty: true },
    });

    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: data.patientId },
      include: {
        address: true,
        phones: true,
        treatmentPlans: {
          include: {
            procedures: {
              include: { procedure: { include: { specialty: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: data.clinicId },
      include: { address: true },
    });

    // Busca o profissional selecionado
    const professional = await prisma.user.findUnique({
      where: { id: data.professionalId },
      select: { signatureImagePath: true, fullName: true },
    });

    // Gera URL da assinatura do profissional
    let professionalSignatureUrl = null;
    if (professional?.signatureImagePath) {
      const { data: signData } = await supabase.storage
        .from(SIGNATURES_BUCKET)
        .createSignedUrl(professional.signatureImagePath, 60 * 10);
      professionalSignatureUrl = signData?.signedUrl;
    }

    // Tratamento de variáveis
    let treatmentPlanData = null;
    if (patient.treatmentPlans.length > 0) {
      const plan = patient.treatmentPlans[0];
      const procedure = plan.procedures[0];
      treatmentPlanData = {
        specialty: procedure?.procedure?.specialty?.name,
        procedure: procedure?.procedure?.name,
        sessions: procedure?.contractedSessions,
        total: plan.total,
      };
    }

    const filledContent = substituteVariables(template.content, {
      patient,
      clinic,
      treatmentPlan: treatmentPlanData,
      professionalSignatureUrl, // Passa a assinatura para o PDF inicial
      patientSignatureUrl: null,
    });

    // Gera PDF
    const timestamp = Date.now();
    const fileName = `${template.type.toLowerCase()}_${patient.name.replace(
      / /g,
      "_"
    )}_${timestamp}.pdf`;
    const filePath = `${data.clinicId}/${data.patientId}/${fileName}`;

    const pdfBuffer = await this.generatePDFFromHTML(
      filledContent,
      clinic,
      template.name
    );

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, pdfBuffer, { contentType: "application/pdf" });

    if (uploadError) throw new Error("Erro ao fazer upload do PDF.");

    // Salva no banco COM O PROFESSIONAL_ID
    const document = await prisma.patientDocument.create({
      data: {
        patientId: data.patientId,
        templateId: data.templateId,
        professionalId: data.professionalId, // <--- O PULO DO GATO ESTÁ AQUI
        fileName,
        filePath,
        fileType: "application/pdf",
        size: pdfBuffer.length,
        type: template.type,
        status: "PENDING",
      },
    });

    return document;
  }

  static async signDocument(data: {
    documentId: string;
    signatureBase64: string;
  }) {
    // 1. Busca documento e dados
    const document = await prisma.patientDocument.findUniqueOrThrow({
      where: { id: data.documentId },
      include: {
        patient: {
          include: {
            address: true,
            phones: true,
            treatmentPlans: {
              include: {
                procedures: {
                  include: { procedure: { include: { specialty: true } } },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            appointments: {
              orderBy: { date: "desc" },
              take: 1,
              select: { professionalId: true },
            },
          },
        },
        template: true,
      },
    });

    if (document.status === "SIGNED") {
      throw new Error("Este documento já foi assinado e finalizado.");
    }

    // --- NOVO: Descobre o ClinicId através do paciente dono do documento ---
    const clinicId = document.patient.clinicId;
    // ----------------------------------------------------------------------

    if (!document.template) {
      throw new Error(
        "Documento sem template não pode ser assinado digitalmente."
      );
    }

    // 2. Upload da assinatura do PACIENTE
    const signatureBuffer = Buffer.from(
      data.signatureBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    // Usa a variável clinicId descoberta acima
    const patientSignaturePath = `${clinicId}/${document.patientId}/signatures/${document.id}_patient.png`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(patientSignaturePath, signatureBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) throw new Error("Erro ao salvar assinatura do paciente.");

    // 3. URL assinada do PACIENTE
    const { data: patSignData } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(patientSignaturePath, 120);

    // 4. URL assinada do PROFISSIONAL
    let professionalSignatureUrl = null;
    let professionalId = null;

    // (Lógica de buscar profissional mantida igual, usa professionalId se existir ou tenta descobrir)
    if (document.professionalId) {
      professionalId = document.professionalId;
    } else {
      // Fallbacks antigos
      const plan = document.patient.treatmentPlans[0];
      if (plan && plan.sellerId) professionalId = plan.sellerId;
      else if (document.patient.appointments.length > 0)
        professionalId = document.patient.appointments[0].professionalId;
    }

    if (professionalId) {
      const professional = await prisma.user.findUnique({
        where: { id: professionalId },
        select: { signatureImagePath: true },
      });

      if (professional?.signatureImagePath) {
        const { data: profSignData } = await supabase.storage
          .from(SIGNATURES_BUCKET)
          .createSignedUrl(professional.signatureImagePath, 120);

        professionalSignatureUrl = profSignData?.signedUrl;
      }
    }

    // Busca dados da clínica usando o ID descoberto
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId }, // <--- Usa a variável local
      include: { address: true },
    });

    // Dados do plano para o template (Mantido igual)
    let treatmentPlanData = null;
    const plan = document.patient.treatmentPlans[0];
    if (plan) {
      const proc = plan.procedures[0];
      treatmentPlanData = {
        specialty: proc?.procedure?.specialty?.name,
        procedure: proc?.procedure?.name,
        sessions: proc?.contractedSessions,
        total: plan.total,
      };
    }

    // 5. REGENERA O HTML
    const filledContent = substituteVariables(document.template.content, {
      patient: document.patient,
      clinic,
      treatmentPlan: treatmentPlanData,
      professionalSignatureUrl,
      patientSignatureUrl: patSignData?.signedUrl,
    });

    // 6. Gera o NOVO PDF
    const pdfBuffer = await this.generatePDFFromHTML(
      filledContent,
      clinic,
      document.fileName.replace(".pdf", "")
    );

    // 7. Sobrescreve o PDF antigo
    const { error: pdfUploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(document.filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfUploadError) throw new Error("Erro ao atualizar o PDF assinado.");

    // 8. Atualiza status no banco
    await prisma.patientDocument.update({
      where: { id: data.documentId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        patientSignaturePath: patientSignaturePath,
        size: pdfBuffer.length,
      },
    });

    return { success: true };
  }

  private static async generatePDFFromHTML(
    content: string,
    clinic: any,
    documentTitle: string
  ): Promise<Buffer> {
    const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
      <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
      ${
        clinic.address
          ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>`
          : ""
      }
      <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
    </div>
  `;

    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 2cm 1.5cm;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

    const pdfBuffer = await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
      margin: { top: "120px", bottom: "60px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }

  static async getAttendanceData(appointmentId: string, clinicId: string) {
    const appointment = await prisma.appointment.findFirstOrThrow({
      where: { id: appointmentId, patient: { clinicId } },
      include: {
        patient: true,
        professional: { select: { fullName: true } },
        treatmentPlan: {
          include: {
            procedures: {
              include: {
                procedure: {
                  include: {
                    specialty: true,
                  },
                },
              },
            },
          },
        },
        clinicalRecord: true,
      },
    });

    const assessments = await prisma.patientAssessment.findMany({
      where: { patientId: appointment.patient.id },
      include: {
        template: true,
        appointment: {
          include: {
            appointmentType: true,
          },
        },
        professional: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const patientHistory = await prisma.appointment.findMany({
      where: { patientId: appointment.patient.id },
      include: {
        appointmentType: true,
        professional: true,
        assessment: { select: { id: true } },
        clinicalRecord: true,
      },
      orderBy: { date: "desc" },
    });

    const beforeAfterImages = await prisma.beforeAfterImage.findMany({
      where: { patientId: appointment.patient.id },
      orderBy: { createdAt: "desc" },
    });

    const imagesWithUrls = await Promise.all(
      beforeAfterImages.map(async (image) => {
        const { data: beforeData } = await supabase.storage
          .from(BEFORE_AFTER_BUCKET)
          .createSignedUrl(image.beforeImagePath, 60 * 5);

        let afterSignedUrl = null;
        if (image.afterImagePath) {
          const { data: afterData } = await supabase.storage
            .from(BEFORE_AFTER_BUCKET)
            .createSignedUrl(image.afterImagePath, 60 * 5);
          afterSignedUrl = afterData?.signedUrl ?? null;
        }

        return {
          ...image,
          beforeImagePath: beforeData?.signedUrl ?? "",
          afterImagePath: afterSignedUrl,
        };
      })
    );

    return {
      appointment: appointment,
      patient: {
        ...appointment.patient,
        beforeAfterImages: imagesWithUrls,
      },
      treatmentPlan: appointment.treatmentPlan,
      clinicalRecord: appointment.clinicalRecord,
      assessments,
      patientHistory,
    };
  }

  static async saveDiagnosis(
    appointmentId: string,
    diagnosis: string | null | undefined
  ) {
    return prisma.clinicalRecord.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        diagnosis: diagnosis || "",
      },
      update: {
        diagnosis: diagnosis || "",
      },
    });
  }

  static async listAttachments(patientId: string) {
    const attachments = await prisma.attachment.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        let viewUrl: string | null = null;
        if (attachment.fileType.startsWith("image/")) {
          const { data } = await supabase.storage
            .from(ATTACHMENTS_BUCKET)
            .createSignedUrl(attachment.filePath, 60 * 5);
          viewUrl = data?.signedUrl ?? null;
        }
        return { ...attachment, viewUrl };
      })
    );
    return attachmentsWithUrls;
  }

  static async createSignedUploadUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    // ================= FIX IS HERE =================
    // The second argument `60` is removed. The function no longer takes an expiration time.
    // It uses a default expiration set by Supabase (usually one hour).
    const { data: signedUrlData, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error:", error);
      throw new Error("Could not create signed upload URL");
    }
    // ===============================================

    return { ...signedUrlData, filePath };
  }

  static async saveAttachment(data: z.infer<typeof saveAttachmentSchema>) {
    // CORREÇÃO AQUI: Usar findFirstOrThrow para evitar o erro de 'possibly null'
    const clinic = await prisma.clinic.findFirstOrThrow({
      where: { patients: { some: { id: data.patientId } } },
    });

    await this.checkStorageLimit(clinic.id, data.size);

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        storageUsed: { increment: data.size },
      },
    });

    return prisma.attachment.create({
      data: {
        patientId: data.patientId,
        fileName: data.fileName,
        description: data.description,
        filePath: data.filePath,
        fileType: data.fileType,
        size: data.size,
      },
    });
  }

  static async deleteAttachment(attachmentId: string, clinicId: string) {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: {
        id: attachmentId,
        patient: { clinicId },
      },
    });

    const { error: storageError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([attachment.filePath]);

    if (storageError) {
      console.error("Supabase storage deletion error:", storageError.message);
    }

    const patient = await prisma.patient.findUnique({
      where: { id: attachment.patientId },
      select: { clinicId: true },
    });

    if (patient) {
      await prisma.clinic.update({
        where: { id: patient.clinicId },
        data: {
          storageUsed: { decrement: attachment.size },
        },
      });
    }

    await prisma.attachment.delete({
      where: { id: attachmentId },
    });
  }

  static async getBeforeAfterImages(patientId: string) {
    const images = await prisma.beforeAfterImage.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        const { data: beforeData } = await supabase.storage
          .from(BEFORE_AFTER_BUCKET)
          .createSignedUrl(image.beforeImagePath, 60 * 5);

        let afterSignedUrl: string | null = null;
        if (image.afterImagePath) {
          const { data: afterData } = await supabase.storage
            .from(BEFORE_AFTER_BUCKET)
            .createSignedUrl(image.afterImagePath, 60 * 5);
          afterSignedUrl = afterData?.signedUrl ?? null;
        }

        return {
          ...image,
          beforeImageSignedUrl: beforeData?.signedUrl ?? null,
          afterImageSignedUrl: afterSignedUrl,
        };
      })
    );
    return imagesWithUrls;
  }

  static async getBeforeAfterDownloadUrl(
    imageId: string,
    type: "before" | "after",
    clinicId: string
  ) {
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: { id: imageId, patient: { clinicId } },
    });

    const filePath =
      type === "before" ? image.beforeImagePath : image.afterImagePath;

    if (!filePath) {
      throw new Error(`Image type '${type}' not found.`);
    }

    const { data, error } = await supabase.storage
      .from(BEFORE_AFTER_BUCKET)
      .createSignedUrl(filePath, 3600, {
        download: `${type}-${image.id}.jpg`,
      });

    if (error || !data) {
      throw new Error("Could not generate download URL");
    }
    return { signedUrl: data.signedUrl };
  }

  static async createBeforeAfterSignedUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
    imageType: "before" | "after";
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${data.imageType}-${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    const { data: signedUrlData, error } = await supabase.storage
      .from(BEFORE_AFTER_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error (before-after):", error);
      throw new Error(
        "Could not create signed upload URL for before/after image"
      );
    }

    return { ...signedUrlData, filePath };
  }

  static async saveBeforeAfterImage(
    data: z.infer<typeof saveBeforeAfterSchema>
  ) {
    return prisma.beforeAfterImage.create({
      data: {
        patientId: data.patientId,
        treatmentPlanId: data.treatmentPlanId,
        description: data.description,
        beforeImagePath: data.beforeImagePath,
        afterImagePath: data.afterImagePath,
      },
    });
  }

  static async updateAfterImage(imageId: string, afterImagePath: string) {
    return prisma.beforeAfterImage.update({
      where: { id: imageId },
      data: { afterImagePath },
    });
  }

  static async deleteBeforeAfterImage(imageId: string, clinicId: string) {
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: {
        id: imageId,
        patient: { clinicId }, // Garante que a imagem pertence à clínica do usuário
      },
    });

    const filesToRemove = [image.beforeImagePath];
    if (image.afterImagePath) {
      filesToRemove.push(image.afterImagePath);
    }

    await supabase.storage.from(BEFORE_AFTER_BUCKET).remove(filesToRemove);

    await prisma.beforeAfterImage.delete({
      where: { id: imageId },
    });
  }

  // List documents by patient and type
  static async listDocuments(patientId: string, type: DocumentType) {
    const documents = await prisma.patientDocument.findMany({
      where: {
        patientId,
        type,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return documents;
  }

  // Create signed URL for document upload
  static async createDocumentSignedUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
    documentType: DocumentType;
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${data.documentType.toLowerCase()}-${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    const { data: signedUrlData, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error (documents):", error);
      throw new Error("Could not create signed upload URL for document");
    }

    return { ...signedUrlData, filePath };
  }

  // Save document metadata to database
  static async saveDocument(data: {
    patientId: string;
    fileName: string;
    description?: string | null;
    filePath: string;
    fileType: string;
    size: number;
    documentType: DocumentType;
  }) {
    return prisma.patientDocument.create({
      data: {
        patientId: data.patientId,
        fileName: data.fileName,
        description: data.description,
        filePath: data.filePath,
        fileType: data.fileType,
        size: data.size,
        type: data.documentType,
        status: "PENDING",
      },
    });
  }

  // Delete a document
  static async deleteDocument(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId },
      },
    });

    // Remove from storage
    if (document.filePath) {
      const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([document.filePath]);

      if (error) {
        console.error(
          "Supabase storage deletion error (documents):",
          error.message
        );
      }
    }

    // Delete from database
    await prisma.patientDocument.delete({
      where: { id: documentId },
    });
  }

  // Get signed download URL
  static async getDocumentDownloadUrl(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId },
      },
    });

    if (!document.filePath) {
      throw new Error("Document file not found");
    }

    // Create a signed URL that expires in 1 hour
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(document.filePath, 3600); // 3600 seconds = 1 hour

    if (error || !data) {
      console.error("Error creating signed URL:", error);
      throw new Error("Could not generate download URL");
    }

    return {
      signedUrl: data.signedUrl,
      fileName: document.fileName,
      fileType: document.fileType,
    };
  }

  static async getAttachmentDownloadUrl(
    attachmentId: string,
    clinicId: string
  ) {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: {
        id: attachmentId,
        patient: { clinicId },
      },
    });

    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.filePath, 3600, {
        // 1 hour expiration
        download: attachment.fileName, // This prompts a download with the correct filename
      });

    if (error || !data) {
      console.error(
        "Error creating signed download URL for attachment:",
        error
      );
      throw new Error("Could not generate download URL");
    }

    return { signedUrl: data.signedUrl };
  }
}

```

# auth.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../schemas/auth.schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

// --- NOVA INTERFACE (para o payload do JWT) ---
// Note que roleId e clinicId podem ser nulos
interface UserPayload {
  userId: string;
  roleId: string | null;
  clinicId: string | null;
  accountId: string; // Todos agora pertencem a uma conta
}

export class AuthService {
  static async login(data: LoginInput) {
    const { email, password } = data;

    // --- MUDANÇA AQUI ---
    // Buscamos o usuário e suas *potenciais* relações (de Dono ou de Funcionário)
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clinic: { select: { accountId: true } }, // Se for funcionário, pegamos o accountId da clínica
        ownedAccount: { select: { id: true } }, // Se for dono, pegamos o ID da conta dele
      },
    });

    if (!user) {
      throw { code: "UNAUTHORIZED", message: "Email ou senha inválidos." };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw { code: "UNAUTHORIZED", message: "Email ou senha inválidos." };
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("Chave secreta JWT não configurada.");
    }

    // --- MUDANÇA AQUI ---
    // Monta o payload do JWT dinamicamente
    let payload: UserPayload;

    if (user.clinicId && user.clinic) {
      // É um FUNCIONÁRIO
      payload = {
        userId: user.id,
        roleId: user.roleId,
        clinicId: user.clinicId,
        accountId: user.clinic.accountId, // O ID da conta "mãe"
      };
    } else if (user.ownedAccount) {
      // É um DONO
      payload = {
        userId: user.id,
        roleId: null, // Dono não tem "Role" de clínica
        clinicId: null, // Dono não tem *uma* clínica, tem várias
        accountId: user.ownedAccount.id, // O ID da conta dele
      };
    } else {
      // Caso de erro: usuário órfão (sempre bom ter um fallback)
      console.error(`Usuário ${user.id} não é nem dono nem funcionário.`);
      throw {
        code: "UNAUTHORIZED",
        message: "Configuração de usuário inválida.",
      };
    }

    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    // --- MUDANÇA AQUI ---
    // Removemos o ownedAccount e clinic do objeto de retorno para
    // manter a resposta limpa, assim como era antes.
    const { passwordHash, clinic, ownedAccount, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  static async register(data: RegisterInput) {
    const { email, taxId, password, fullName, clinicName, isProfessional } =
      data;

    // 1. Verificar se o email ou CNPJ já existem
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw { code: "CONFLICT", message: "Este email já está em uso." };
    }

    const existingClinic = await prisma.clinic.findUnique({ where: { taxId } });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    // 2. Criptografar a senha
    const passwordHash = await bcrypt.hash(password, 10);

    // --- MUDANÇA AQUI ---
    // A transação agora cria a nova arquitetura:
    // User (Dono) -> Account (Empresa) -> Clinic (Primeira Loja)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar o usuário (DONO)
      // Note que clinicId e roleId são nulos, como manda o novo schema
      const newUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          isProfessional: isProfessional,
          scheduleStartHour: isProfessional ? "08:00" : null,
          scheduleEndHour: isProfessional ? "18:00" : null,
          appointmentDuration: isProfessional ? 60 : null,
          workingDays: isProfessional
            ? ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
            : [],
        },
      });

      // 2. Criar a "Conta" (a empresa/dono do plano)
      const newAccount = await tx.account.create({
        data: { ownerId: newUser.id },
      });

      // 3. Criar a *primeira* Clínica
      const newClinic = await tx.clinic.create({
        data: {
          name: clinicName,
          taxId: taxId,
          status: "ACTIVE",
          accountId: newAccount.id,
        },
      });

      const adminRole = await tx.role.create({
        data: {
          name: "Administrador",
          type: "ADMIN",
          description: "Acesso total ao sistema da clínica",
          isSuperAdmin: true,
          clinicId: newClinic.id, // VINCULADO À CLÍNICA!
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: newUser.id },
        data: {
          roleId: adminRole.id,
        },
      });

      return { newUser: updatedUser, newAccount };
    });

    // 4. Gerar um token JWT para auto-login
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Chave secreta JWT não configurada.");

    // --- MUDANÇA AQUI ---
    // O payload do token de registro é de um DONO
    const payload: UserPayload = {
      userId: result.newUser.id,
      roleId: null,
      clinicId: null,
      accountId: result.newAccount.id,
    };
    const token = jwt.sign(payload, secret, { expiresIn: "7d" });

    // 5. Retornar os dados
    const { passwordHash: _, ...userWithoutPassword } = result.newUser;
    return { user: userWithoutPassword, token };
  }

  static async forgotPassword(data: ForgotPasswordInput) {
    const { email } = data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000); // Expira em 1 hora

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      // --- MUDANÇA AQUI: Removido "onboarding@resend.dev" ---
      // Usando o domínio de produção verificado
      await resend.emails.send({
        from: "Belliun <nao-responda@belliun.com.br>",
        to: user.email,
        subject: "Redefinição de Senha - Belliun",
        html: `<p>Olá ${user.fullName},</p><p>Você solicitou a redefinição de sua senha. Clique no link abaixo para criar uma nova senha:</p><a href="${resetLink}">Redefinir Senha</a><p>Se você não solicitou isso, por favor, ignore este email.</p>`,
      });
    }
    return {
      message:
        "Se um usuário com este email existir, um link de redefinição foi enviado.",
    };
  }

  static async resetPassword(data: ResetPasswordInput) {
    const { token, password } = data;

    // 1. Encontrar o token no banco
    const savedToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!savedToken) {
      throw { code: "NOT_FOUND", message: "Token inválido ou expirado." };
    }

    // 2. Verificar se o token expirou
    if (new Date() > savedToken.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { id: savedToken.id } });
      throw {
        code: "GONE",
        message: "Token expirado. Por favor, solicite um novo.",
      };
    }

    // 3. Criptografar a nova senha
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Atualizar a senha do usuário e deletar o token em uma transação
    await prisma.$transaction([
      prisma.user.update({
        where: { id: savedToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({
        where: { id: savedToken.id },
      }),
    ]);

    return { message: "Senha redefinida com sucesso!" };
  }
}

```

# bankAccount.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
} from "../schemas/bankAccount.schema";
import { z } from "zod";

export class BankAccountService {
  static async create(
    clinicId: string,
    data: z.infer<typeof createBankAccountSchema>
  ) {
    return prisma.bankAccount.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.BankAccountWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [data, totalCount] = await prisma.$transaction([
      prisma.bankAccount.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.bankAccount.count({ where }),
    ]);

    return { data, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId },
    });
  }

  static async update(
    id: string,
    clinicId: string,
    data: z.infer<typeof updateBankAccountSchema>
  ) {
    await prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.bankAccount.update({
      where: { id },
      data: {
        name: data.name, // Permite apenas a atualização do nome
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir exclusão se a conta tiver transações
    // ou sessões de caixa (abertas ou fechadas).
    const transactionCount = await prisma.financialTransaction.count({
      where: { bankAccountId: id },
    });
    const sessionCount = await prisma.cashRegisterSession.count({
      where: { bankAccountId: id },
    });

    if (transactionCount > 0 || sessionCount > 0) {
      throw new Error("ACCOUNT_IN_USE");
    }

    return prisma.bankAccount.delete({ where: { id } });
  }
}

```

# cashRegister.service.ts

```ts
// src/services/cashRegister.service.ts
import { prisma } from "../lib/prisma";
import { CashRegisterSessionStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class CashRegisterService {
  /**
   * Abre uma nova sessão de caixa para uma conta bancária.
   */
  static async openSession(
    clinicId: string,
    userId: string,
    bankAccountId: string,
    observedOpening: number
  ) {
    // 1. Verifica se já existe uma sessão aberta para esta conta
    const existingOpenSession = await prisma.cashRegisterSession.findFirst({
      where: { bankAccountId, status: "OPEN", clinicId },
    });
    if (existingOpenSession) {
      throw new Error("Já existe uma sessão de caixa aberta para esta conta.");
    }

    // 2. Busca o saldo atual real da conta no banco de dados
    const bankAccount = await prisma.bankAccount.findFirstOrThrow({
      where: { id: bankAccountId, clinicId },
    });

    // 3. Cria a nova sessão
    const newSession = await prisma.cashRegisterSession.create({
      data: {
        clinicId,
        bankAccountId,
        openedByUserId: userId,
        openingBalance: bankAccount.balance, // Saldo real do sistema
        observedOpening: new Decimal(observedOpening.toFixed(2)), // Saldo contado pelo usuário
        status: CashRegisterSessionStatus.OPEN,
      },
      include: {
        bankAccount: { select: { id: true, name: true } }, // Garantir ID aqui também
        openedByUser: { select: { fullName: true } },
      },
    });

    return newSession;
  }

  /**
   * Fecha uma sessão de caixa aberta.
   */
  static async closeSession(
    clinicId: string,
    userId: string,
    sessionId: string,
    observedClosing: number,
    notes: string | null | undefined
  ) {
    // 1. Encontra a sessão que deve ser fechada
    const session = await prisma.cashRegisterSession.findFirstOrThrow({
      where: { id: sessionId, clinicId, status: "OPEN" },
    });

    // 2. Busca o saldo atualizado da conta (que reflete todas as transações)
    const bankAccount = await prisma.bankAccount.findFirstOrThrow({
      where: { id: session.bankAccountId },
    });

    const closingBalance = bankAccount.balance; // Saldo real do sistema
    const observedClosingDecimal = new Decimal(observedClosing.toFixed(2));
    const discrepancy = observedClosingDecimal.sub(closingBalance);

    // 3. Atualiza (fecha) a sessão
    const closedSession = await prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        status: CashRegisterSessionStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: userId,
        closingBalance: closingBalance,
        observedClosing: observedClosingDecimal,
        discrepancy: discrepancy,
        notes: notes,
      },
    });

    return closedSession;
  }

  /**
   * Busca a sessão de caixa ativa (aberta) para uma determinada conta.
   */
  static async getActiveSession(clinicId: string, bankAccountId: string) {
    const session = await prisma.cashRegisterSession.findFirst({
      where: { clinicId, bankAccountId, status: "OPEN" },
      include: {
        bankAccount: { select: { id: true, name: true, balance: true } }, // Garantir ID aqui
        openedByUser: { select: { fullName: true } },
      },
    });

    if (!session) {
      // Se não houver sessão aberta, retorna o status da conta para o front-end
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, clinicId },
        // --- CORREÇÃO APLICADA AQUI ---
        select: { id: true, name: true, balance: true },
      });
      return { session: null, bankAccount };
    }

    return { session, bankAccount: session.bankAccount };
  }

  /**
   * Busca os detalhes de uma sessão (aberta ou fechada),
   * incluindo todas as transações financeiras vinculadas.
   */
  static async getSessionDetails(clinicId: string, sessionId: string) {
    const session = await prisma.cashRegisterSession.findFirstOrThrow({
      where: { id: sessionId, clinicId },
      include: {
        bankAccount: { select: { name: true } },
        openedByUser: { select: { fullName: true } },
        closedByUser: { select: { fullName: true } },
        transactions: {
          orderBy: { date: "asc" },
          include: {
            paymentInstallment: {
              select: {
                installmentNumber: true,
                paymentMethod: true,
                treatmentPlan: {
                  select: { patient: { select: { name: true } } },
                },
              },
            },
            expense: {
              select: {
                description: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Calcula os totais da sessão
    const totals = session.transactions.reduce(
      (acc, tx) => {
        if (tx.type === "REVENUE") {
          acc.totalRevenue = acc.totalRevenue.add(tx.amount);
        } else if (tx.type === "EXPENSE") {
          acc.totalExpense = acc.totalExpense.add(tx.amount);
        }
        return acc;
      },
      {
        totalRevenue: new Decimal(0),
        totalExpense: new Decimal(0),
      }
    );

    return { ...session, ...totals };
  }

  /**
   * Lista todas as sessões (abertas ou fechadas) com filtros.
   */
  static async listSessions(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: CashRegisterSessionStatus;
      dateStart?: string;
      dateEnd?: string;
      bankAccountId?: string;
    }
  ) {
    const where: Prisma.CashRegisterSessionWhereInput = { clinicId };

    if (filters.status) where.status = filters.status;
    if (filters.bankAccountId) where.bankAccountId = filters.bankAccountId;
    if (filters.dateStart || filters.dateEnd) {
      where.openedAt = {};
      if (filters.dateStart) where.openedAt.gte = new Date(filters.dateStart);
      if (filters.dateEnd) where.openedAt.lte = new Date(filters.dateEnd);
    }

    const skip = (page - 1) * pageSize;
    const [sessions, totalCount] = await prisma.$transaction([
      prisma.cashRegisterSession.findMany({
        where,
        include: {
          bankAccount: { select: { name: true } },
          openedByUser: { select: { fullName: true } },
          closedByUser: { select: { fullName: true } },
          _count: { select: { transactions: true } },
        },
        skip,
        take: pageSize,
        orderBy: { openedAt: "desc" },
      }),
      prisma.cashRegisterSession.count({ where }),
    ]);

    return { data: sessions, totalCount };
  }
}

```

# catalog.service.ts

```ts
import { prisma } from "../lib/prisma";
import * as XLSX from "xlsx";

type CatalogModel =
  | "specialty"
  | "appointmentType"
  | "trafficSource"
  | "procedure"
  | "role";

export class CatalogService {
  // Busca item garantindo que pertence à clínica
  static async getById(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    return prisma[model].findFirst({
      where: {
        id,
        clinicId,
      },
    });
  }

  // Lista APENAS itens da clínica
  static async list(model: CatalogModel, clinicId: string) {
    // @ts-ignore
    return prisma[model].findMany({
      where: {
        clinicId: clinicId,
      },
      orderBy: { name: "asc" },
    });
  }

  static async create(
    model: CatalogModel,
    data: { name: string },
    clinicId: string
  ) {
    // @ts-ignore
    return prisma[model].create({
      data: { ...data, clinicId },
    });
  }

  static async update(
    model: CatalogModel,
    id: string,
    data: { name: string },
    clinicId: string
  ) {
    // @ts-ignore
    await prisma[model].findFirstOrThrow({ where: { id, clinicId } });
    // @ts-ignore
    return prisma[model].update({ where: { id }, data });
  }

  static async delete(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    await prisma[model].findFirstOrThrow({ where: { id, clinicId } });
    // @ts-ignore
    return prisma[model].delete({ where: { id } });
  }

  static async listProcedures(clinicId: string) {
    return prisma.procedure.findMany({
      where: {
        clinicId, // <--- Apenas desta clínica
      },
      include: { specialty: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  static async createProcedure(data: any, clinicId: string) {
    return prisma.procedure.create({
      data: { ...data, clinicId },
    });
  }

  static async updateProcedure(id: string, data: any, clinicId: string) {
    await prisma.procedure.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.procedure.update({ where: { id }, data });
  }

  static async importProcedures(fileBuffer: Buffer, clinicId: string) {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Converte para JSON
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
    });

    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // CRIA UM NOVO OBJETO COM AS CHAVES LIMPAS (SEM ESPAÇOS)
      const cleanRow: any = {};
      Object.keys(row).forEach((key) => {
        cleanRow[key.trim()] = row[key];
      });

      // AGORA BUSCA NAS CHAVES LIMPAS
      const name =
        cleanRow["Nome"] || cleanRow["nome"] || cleanRow["Procedimento"];
      const specialtyName =
        cleanRow["Especialidade"] ||
        cleanRow["especialidade"] ||
        cleanRow["Categoria"];
      const priceRaw =
        cleanRow["Preço"] || cleanRow["Valor"] || cleanRow["Preco"] || "0";

      if (!name || !specialtyName) {
        // Log para você debugar se necessário
        console.log(`Erro na linha ${rowNum}:`, cleanRow);
        results.errors.push(
          `Linha ${rowNum}: Nome e Especialidade são obrigatórios.`
        );
        continue;
      }

      let standardPrice = 0;

      let raw = priceRaw?.toString().trim() ?? "0";
      raw = raw.replace(/^R\$\s?/, "");

      if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(raw)) {
        raw = raw.replace(/\./g, "").replace(",", ".");
        standardPrice = Number(raw);
      } else if (/^\d+,\d{2}$/.test(raw)) {
        raw = raw.replace(",", ".");
        standardPrice = Number(raw);
      } else if (/^\d+(\.\d+)?$/.test(raw)) {
        standardPrice = Number(raw);
      }

      if (isNaN(standardPrice)) standardPrice = 0;

      try {
        await prisma.$transaction(async (tx) => {
          // 1. Busca ou Cria Especialidade
          let specialty = await tx.specialty.findFirst({
            where: {
              name: { equals: specialtyName, mode: "insensitive" },
              clinicId: clinicId,
            },
          });

          if (!specialty) {
            specialty = await tx.specialty.create({
              data: {
                name: specialtyName,
                clinicId: clinicId,
              },
            });
          }

          // 2. Cria ou Atualiza Procedimento
          const existingProc = await tx.procedure.findFirst({
            where: {
              name: { equals: name, mode: "insensitive" },
              clinicId: clinicId,
            },
          });

          if (!existingProc) {
            await tx.procedure.create({
              data: {
                name,
                standardPrice,
                specialtyId: specialty.id,
                clinicId,
              },
            });
            results.success++;
          } else {
            // Opcional: Atualizar preço se já existir? Por segurança, apenas avisamos.
            results.errors.push(
              `Linha ${rowNum}: Procedimento "${name}" já existe.`
            );
          }
        });
      } catch (error) {
        console.error(error);
        results.errors.push(`Linha ${rowNum}: Erro ao salvar "${name}".`);
      }
    }

    return results;
  }
}

```

# clinic.service.ts

```ts
import { prisma } from "../lib/prisma";

export class ClinicService {
  static async create(ownerId: string, data: { name: string; taxId: string }) {
    // 1. Primeiro, encontramos a Conta (Account) que pertence a este usuário (Dono)
    const account = await prisma.account.findUnique({
      where: { ownerId },
    });

    if (!account) {
      throw new Error(
        "Conta principal não encontrada. Entre em contato com o suporte."
      );
    }

    // 2. Criamos a clínica vinculada a essa conta com status ACTIVE
    return prisma.clinic.create({
      data: {
        name: data.name,
        taxId: data.taxId,
        status: "ACTIVE", // Já nasce ativa conforme seu pedido
        accountId: account.id,
      },
    });
  }

  static async update(id: string, ownerId: string, data: any) {
    // Verifica se a clínica pertence a uma conta que o usuário é dono
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId }, // Garante segurança: só o dono altera
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    return prisma.clinic.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, ownerId: string) {
    // Verifica propriedade
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId },
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    // ATENÇÃO: O delete falhará se houver dados vinculados (pacientes, etc)
    // a menos que o Cascade esteja configurado no Schema do Prisma.
    // Se não estiver, seria necessário deletar os dados filhos antes.
    return prisma.clinic.delete({
      where: { id },
    });
  }
}

```

# commissionPlan.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateCommissionPlanInput,
  UpdateCommissionPlanInput,
} from "../schemas/commission.schema";

export class CommissionPlanService {
  /**
   * Cria um novo plano de comissão e suas faixas (tiers) de forma transacional.
   */
  static async create(data: CreateCommissionPlanInput, clinicId: string) {
    const { tiers, ...planData } = data;

    return prisma.commissionPlan.create({
      data: {
        ...planData,
        clinicId,
        tiers: {
          create: tiers, // Prisma cria as faixas relacionadas
        },
      },
      include: { tiers: { orderBy: { minThreshold: "asc" } } },
    });
  }

  /**
   * Lista os planos de comissão da clínica.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.CommissionPlanWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [plans, totalCount] = await prisma.$transaction([
      prisma.commissionPlan.findMany({
        where,
        include: { tiers: { orderBy: { minThreshold: "asc" } } },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.commissionPlan.count({ where }),
    ]);

    return { data: plans, totalCount };
  }

  /**
   * Busca um plano de comissão específico pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.commissionPlan.findFirst({
      where: { id, clinicId },
      include: { tiers: { orderBy: { minThreshold: "asc" } } },
    });
  }

  /**
   * Atualiza um plano de comissão. A estratégia é substituir todas as faixas antigas pelas novas.
   */
  static async update(
    id: string,
    data: UpdateCommissionPlanInput,
    clinicId: string
  ) {
    const { tiers, ...planData } = data;

    return prisma.$transaction(async (tx) => {
      // Garante que o plano pertence à clínica
      await tx.commissionPlan.findFirstOrThrow({ where: { id, clinicId } });

      // Atualiza os dados do plano (nome, descrição, etc.)
      const updatedPlan = await tx.commissionPlan.update({
        where: { id },
        data: { ...planData },
      });

      // Se novas faixas foram enviadas, substitui as antigas
      if (tiers) {
        // 1. Deleta todas as faixas antigas
        await tx.commissionTier.deleteMany({ where: { commissionPlanId: id } });
        // 2. Cria as novas faixas
        await tx.commissionTier.createMany({
          data: tiers.map((tier) => ({ ...tier, commissionPlanId: id })),
        });
      }

      // Retorna o plano completo e atualizado
      return tx.commissionPlan.findUnique({
        where: { id },
        include: { tiers: { orderBy: { minThreshold: "asc" } } },
      });
    });
  }

  /**
   * Deleta um plano, verificando se ele não está em uso por algum profissional.
   */
  static async delete(id: string, clinicId: string) {
    await prisma.commissionPlan.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Impede a exclusão se o plano estiver vinculado a um usuário.
    const userCount = await prisma.user.count({
      where: { commissionPlanId: id },
    });

    if (userCount > 0) {
      throw new Error("PLAN_IN_USE");
    }

    // A exclusão dos tiers acontece em cascata (onDelete: Cascade no Prisma schema)
    return prisma.commissionPlan.delete({ where: { id } });
  }
}

```

# commissionRecord.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  Prisma,
  CommissionStatus,
  CommissionTriggerEvent,
} from "@prisma/client";
import { MarkCommissionAsPaidInput } from "../schemas/commissionRecord.schema";

// Interface interna para criação
interface CreateCommissionRecordData {
  clinicId: string;
  professionalId: string;
  treatmentPlanId: string;
  paymentInstallmentId?: string;
  calculatedAmount: number | Prisma.Decimal;
}
// Interface para os dados necessários para criar um registro de comissão
// Usado internamente por outros serviços
interface CreateCommissionRecordData {
  clinicId: string;
  professionalId: string;
  treatmentPlanId: string;
  paymentInstallmentId?: string; // Opcional, se a comissão for por parcela
  calculatedAmount: number | Prisma.Decimal;
}

export class CommissionRecordService {
  /**
   * (Método Interno) Cria um registro de comissão.
   * Chamado por outros serviços (ex: PaymentInstallmentService).
   * Usamos 'tx' para garantir que seja chamado dentro de uma transação.
   */
  static async create(
    tx: Prisma.TransactionClient,
    data: CreateCommissionRecordData
  ) {
    // Adiciona validação básica para garantir que o valor é numérico e não negativo
    if (
      typeof data.calculatedAmount !== "number" &&
      !(data.calculatedAmount instanceof Prisma.Decimal)
    ) {
      throw new TypeError("calculatedAmount deve ser um número ou Decimal.");
    }
    if (Number(data.calculatedAmount) < 0) {
      console.warn(
        `Tentativa de criar comissão com valor negativo (${data.calculatedAmount}) para o plano ${data.treatmentPlanId}. Comissão não será criada.`
      );
      return null; // Ou lançar um erro, dependendo da regra de negócio
    }

    return tx.commissionRecord.create({
      data: {
        ...data,
        calculatedAmount: new Prisma.Decimal(data.calculatedAmount.toString()), // Garante que é Decimal
        status: CommissionStatus.PENDING,
        calculationDate: new Date(),
      },
    });
  }

  /**
   * Calcula e registra a comissão baseada em um TreatmentPlan.
   * Regra Exemplo: Comissão é X% sobre o valor TOTAL do plano, liberada quando a PRIMEIRA parcela é paga.
   */
  static async calculateAndRecordCommissionForPlan(
    tx: Prisma.TransactionClient,
    treatmentPlanId: string,
    paymentInstallmentId?: string // Opcional: ID da parcela que foi paga (relevante para alguns gatilhos)
  ) {
    // 1. Busca dados essenciais (Plano, Vendedor, Plano de Comissão, Tiers)
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      include: {
        seller: {
          include: {
            CommissionPlan: {
              include: { tiers: { orderBy: { minThreshold: "asc" } } },
            },
          },
        },
      },
    });

    // Validação robusta
    if (
      !plan?.seller?.CommissionPlan?.tiers ||
      plan.seller.CommissionPlan.tiers.length === 0
    ) {
      console.warn(
        `Plano ${treatmentPlanId} ou vendedor/plano de comissão não encontrado/configurado para cálculo.`
      );
      return null;
    }

    const seller = plan.seller;
    const commissionPlan = seller.CommissionPlan; // Sabemos que existe
    const tiers = commissionPlan!.tiers;
    const triggerEvent = commissionPlan!.triggerEvent; // Pega o gatilho configurado

    // 2. Verifica Idempotência (Não recalcular se já existe PENDING/PAID para o mesmo gatilho/item)
    const existingCommissionWhere: Prisma.CommissionRecordWhereInput = {
      treatmentPlanId: treatmentPlanId,
      status: { in: [CommissionStatus.PENDING, CommissionStatus.PAID] },
    };
    // Se for por parcela, a chave de idempotência inclui a parcela
    if (
      triggerEvent === CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID &&
      paymentInstallmentId
    ) {
      existingCommissionWhere.paymentInstallmentId = paymentInstallmentId;
    }
    const existingCommission = await tx.commissionRecord.findFirst({
      where: existingCommissionWhere,
    });

    if (existingCommission) {
      console.log(
        `Comissão já registrada/paga para ${
          paymentInstallmentId
            ? `parcela ${paymentInstallmentId}`
            : `plano ${treatmentPlanId}`
        } conforme gatilho ${triggerEvent}.`
      );
      return null; // Evita duplicação
    }

    // 3. Define a Base de Cálculo da Comissão
    let commissionBaseAmountDecimal = plan.total; // Padrão: Total do plano
    if (
      triggerEvent === CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID &&
      paymentInstallmentId
    ) {
      const installment = await tx.paymentInstallment.findUnique({
        where: { id: paymentInstallmentId },
      });
      if (installment) {
        commissionBaseAmountDecimal = installment.amountDue; // Base é o valor da parcela
        console.log(
          `Calculando comissão ON_EACH_INSTALLMENT_PAID sobre ${commissionBaseAmountDecimal} da parcela ${paymentInstallmentId}`
        );
      } else {
        console.warn(
          `Parcela ${paymentInstallmentId} não encontrada para cálculo de comissão por parcela.`
        );
        return null;
      }
    }
    const commissionBaseAmount = Number(commissionBaseAmountDecimal); // Converte para número para comparações

    // 4. Encontra a Faixa de Comissão Aplicável
    let applicableTier = null;
    for (const tier of tiers) {
      const min = Number(tier.minThreshold);
      const max = tier.maxThreshold ? Number(tier.maxThreshold) : null; // Converte max para número ou null

      // Se base for menor que o mínimo da primeira faixa, não aplica nenhuma
      if (commissionBaseAmount < min && tiers.indexOf(tier) === 0) {
        console.log(
          `Valor base ${commissionBaseAmount} abaixo da primeira faixa (${min}) para ${seller.fullName}.`
        );
        applicableTier = null;
        break;
      }

      // Verifica se está dentro da faixa
      if (
        commissionBaseAmount >= min &&
        (max === null || commissionBaseAmount <= max)
      ) {
        applicableTier = tier;
        break; // Encontrou
      }

      // Se chegou na última faixa, ela não tem limite e a base é maior ou igual ao mínimo dela, aplica
      if (
        tiers.indexOf(tier) === tiers.length - 1 &&
        max === null &&
        commissionBaseAmount >= min
      ) {
        applicableTier = tier;
        break;
      }
    }

    if (!applicableTier) {
      console.warn(
        `Nenhuma faixa de comissão encontrada para ${
          seller.fullName
        } no valor base ${commissionBaseAmount} (Plano: ${
          commissionPlan!.name
        }).`
      );
      return null;
    }

    // 5. Calcula o Valor da Comissão
    const commissionAmount =
      (commissionBaseAmount * Number(applicableTier.percentage)) / 100;

    // 6. Cria o Registro de Comissão
    console.log(
      `Criando registro de comissão: ${commissionAmount} para ${
        seller.fullName
      } (Plano: ${treatmentPlanId}, Parcela: ${paymentInstallmentId || "N/A"})`
    );
    return CommissionRecordService.create(tx, {
      clinicId: plan.clinicId,
      professionalId: seller.id,
      treatmentPlanId: plan.id,
      paymentInstallmentId: paymentInstallmentId, // Passa ID da parcela se aplicável
      calculatedAmount: commissionAmount,
    });
  }

  /**
   * Lista os registros de comissão com filtros e paginação.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      professionalId?: string;
      status?: CommissionStatus;
      dateStart?: string;
      dateEnd?: string; // Filtrar por calculationDate
    }
  ) {
    const where: Prisma.CommissionRecordWhereInput = { clinicId };

    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.status) where.status = filters.status;
    if (filters.dateStart || filters.dateEnd) {
      where.calculationDate = {};
      if (filters.dateStart)
        where.calculationDate.gte = new Date(filters.dateStart);
      if (filters.dateEnd)
        where.calculationDate.lte = new Date(filters.dateEnd);
    }

    const skip = (page - 1) * pageSize;
    const [records, totalCount] = await prisma.$transaction([
      prisma.commissionRecord.findMany({
        where,
        include: {
          professional: { select: { fullName: true } },
          treatmentPlan: {
            select: { id: true, patient: { select: { name: true } } },
          },
        },
        skip,
        take: pageSize,
        orderBy: { calculationDate: "desc" },
      }),
      prisma.commissionRecord.count({ where }),
    ]);

    return { data: records, totalCount };
  }

  /**
   * Marca uma comissão como paga.
   */
  static async markAsPaid(
    id: string,
    clinicId: string,
    data: MarkCommissionAsPaidInput
  ) {
    await prisma.commissionRecord.findFirstOrThrow({
      where: {
        id,
        clinicId,
        status: CommissionStatus.PENDING, // Só pode pagar o que está pendente
      },
    });

    return prisma.commissionRecord.update({
      where: { id },
      data: {
        status: CommissionStatus.PAID,
        paymentDate: new Date(data.paymentDate),
      },
    });
  }
}

```

# dashboard.service.ts

```ts
import { prisma } from "../lib/prisma";

export class DashboardService {
  /**
   * Busca os profissionais de uma clínica específica.
   */
  static async getProfessionals(clinicId: string) {
    // 1. Descobrir quem é o dono dessa clínica
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });

    const ownerId = clinic?.account.ownerId;

    return prisma.user.findMany({
      where: {
        OR: [{ clinicId: clinicId }, ...(ownerId ? [{ id: ownerId }] : [])],
        isProfessional: true,
      },
      select: {
        id: true,
        fullName: true,
        color: true,
      },
      orderBy: { fullName: "asc" },
    });
  }

  /**
   * Busca os agendamentos de uma clínica dentro de um período.
   */
  static async getAppointments(
    clinicId: string,
    startDate: Date,
    endDate: Date,
    professionalIds?: string[]
  ) {
    const whereClause: any = {
      professional: {
        clinicId: clinicId,
      },
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (professionalIds && professionalIds.length > 0) {
      whereClause.professionalId = {
        in: professionalIds,
      };
    }

    return prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            cpf: true,
            phones: true,
          },
        },
        professional: {
          select: {
            fullName: true,
            color: true,
          },
        },
        appointmentType: {
          select: {
            name: true,
          },
        },
        // AQUI ESTÃO AS MUDANÇAS CRUCIAIS:
        treatmentPlan: {
          include: {
            seller: {
              select: {
                fullName: true,
              },
            },
            // 1. Precisamos buscar os irmãos (outros agendamentos) para calcular "Sessão X de Y"
            appointments: {
              select: {
                id: true,
                date: true,
                status: true,
                treatmentPlanProcedureId: true, // Necessário para filtrar apenas os deste procedimento
              },
            },
            procedures: {
              select: {
                id: true, // 2. OBRIGATÓRIO: Precisamos do ID para saber qual item do array é o nosso
                contractedSessions: true,
                completedSessions: true,
                procedure: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });
  }
}

```

# expense.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus, TransactionType } from "@prisma/client";
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  MarkExpenseAsPaidInput,
} from "../schemas/expense.schema";

export class ExpenseService {
  static async create(data: CreateExpenseInput, clinicId: string) {
    // Opcional: Validar se supplierId e categoryId pertencem à clínica
    if (data.supplierId) {
      await prisma.supplier.findFirstOrThrow({
        where: { id: data.supplierId, clinicId },
      });
    }
    if (data.categoryId) {
      await prisma.expenseCategory.findFirstOrThrow({
        where: { id: data.categoryId, clinicId },
      });
    }

    return prisma.expense.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: PaymentStatus[];
      dueDateStart?: string;
      dueDateEnd?: string;
      categoryId?: string;
      supplierId?: string;
    }
  ) {
    const where: Prisma.ExpenseWhereInput = { clinicId };
    const now = new Date();

    // Lógica de Status similar a PaymentInstallment
    if (filters.status && filters.status.length > 0) {
      const directStatuses = filters.status.filter(
        (s) => s !== PaymentStatus.OVERDUE
      );
      const conditions: Prisma.ExpenseWhereInput[] = [];
      if (directStatuses.length > 0)
        conditions.push({ status: { in: directStatuses } });
      if (filters.status.includes(PaymentStatus.OVERDUE)) {
        conditions.push({
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        });
      }
      where.OR = conditions;
    }

    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = {};
      if (filters.dueDateStart)
        where.dueDate.gte = new Date(filters.dueDateStart);
      if (filters.dueDateEnd) where.dueDate.lte = new Date(filters.dueDateEnd);
    }
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.supplierId) where.supplierId = filters.supplierId;

    const skip = (page - 1) * pageSize;
    const [expenses, totalCount] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { dueDate: "asc" },
      }),
      prisma.expense.count({ where }),
    ]);

    // Adiciona status OVERDUE dinamicamente
    const expensesWithStatus = expenses.map((exp) => ({
      ...exp,
      status:
        exp.status === PaymentStatus.PENDING && exp.dueDate < now
          ? PaymentStatus.OVERDUE
          : exp.status,
    }));

    return { data: expensesWithStatus, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.expense.findFirst({
      where: { id, clinicId },
      include: { category: true, supplier: true },
    });
  }

  static async update(id: string, clinicId: string, data: UpdateExpenseInput) {
    await prisma.expense.findFirstOrThrow({ where: { id, clinicId } });
    // Opcional: Validar supplierId e categoryId se forem alterados
    if (data.supplierId)
      await prisma.supplier.findFirstOrThrow({
        where: { id: data.supplierId, clinicId },
      });
    if (data.categoryId)
      await prisma.expenseCategory.findFirstOrThrow({
        where: { id: data.categoryId, clinicId },
      });

    return prisma.expense.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.expense.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.expense.delete({ where: { id } });
  }

  static async markAsPaid(
    id: string,
    clinicId: string,
    data: MarkExpenseAsPaidInput
  ) {
    return prisma.$transaction(async (tx) => {
      // Envolve em transação
      // 1. Valida e busca a despesa
      const expense = await tx.expense.findFirstOrThrow({
        where: {
          id,
          clinicId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        },
      });

      // --- Validação da Conta Bancária ---
      await tx.bankAccount.findFirstOrThrow({
        where: { id: data.bankAccountId, clinicId: clinicId },
      });
      // ---------------------------------

      // 2. Atualiza o status da despesa
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: PaymentStatus.PAID,
          paymentDate: new Date(data.paymentDate),
        },
      });

      const activeSession = await tx.cashRegisterSession.findFirst({
        where: {
          bankAccountId: data.bankAccountId,
          status: "OPEN",
        },
      });

      // 4. REGRA DE NEGÓCIO: Se o caixa estiver fechado, BLOQUEAR.
      if (!activeSession) {
        const bankAccount = await tx.bankAccount.findUnique({
          where: { id: data.bankAccountId },
          select: { name: true },
        });
        throw new Error(
          `CAIXA FECHADO: Não é possível registrar esta despesa pois o caixa "${
            bankAccount?.name || "desconhecido"
          }" está fechado. Abra o caixa primeiro.`
        );
      }

      // 5. Cria a transação financeira de SAÍDA VINCULADA
      await tx.financialTransaction.create({
        data: {
          clinicId: clinicId,
          description: updatedExpense.description,
          amount: updatedExpense.amount,
          type: TransactionType.EXPENSE,
          date: new Date(data.paymentDate),
          bankAccountId: data.bankAccountId,
          expenseId: updatedExpense.id,
          // Vincula obrigatoriamente à sessão ativa
          cashRegisterSessionId: activeSession.id,
        },
      });

      // 6. Atualiza o saldo da BankAccount (DECREMENTAR)
      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { balance: { decrement: updatedExpense.amount } },
      });
      console.log(
        `Saldo da conta ${data.bankAccountId} decrementado em ${updatedExpense.amount}.`
      );

      return updatedExpense; // Retorna a despesa atualizada
    });
  }
}

```

# expenseCategory.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from "../schemas/expenseCategory.schema";

export class ExpenseCategoryService {
  static async create(data: CreateExpenseCategoryInput, clinicId: string) {
    return prisma.expenseCategory.create({ data: { ...data, clinicId } });
  }

  static async list(clinicId: string, name?: string) {
    const where: Prisma.ExpenseCategoryWhereInput = { clinicId };
    if (name) where.name = { contains: name, mode: "insensitive" };
    return prisma.expenseCategory.findMany({ where, orderBy: { name: "asc" } });
  }

  static async getById(id: string, clinicId: string) {
    return prisma.expenseCategory.findFirst({ where: { id, clinicId } });
  }

  static async update(
    id: string,
    clinicId: string,
    data: UpdateExpenseCategoryInput
  ) {
    await prisma.expenseCategory.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.expenseCategory.update({ where: { id }, data });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.expenseCategory.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Não permitir exclusão se usada em despesas
    const expenseCount = await prisma.expense.count({
      where: { categoryId: id },
    });
    if (expenseCount > 0) {
      throw new Error("CATEGORY_IN_USE");
    }
    return prisma.expenseCategory.delete({ where: { id } });
  }
}

```

# medicalReport.service.ts

```ts
import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createReportSchema,
  updateReportSchema,
} from "../schemas/medicalReport.schema";
import PdfService from "./pdf.service";

export class MedicalReportService {
  static async create(data: z.infer<typeof createReportSchema>) {
    return prisma.medicalReport.create({
      data,
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findByPatientId(patientId: string) {
    return prisma.medicalReport.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findById(reportId: string) {
    return prisma.medicalReport.findUniqueOrThrow({
      where: { id: reportId },
    });
  }

  static async update(
    reportId: string,
    data: z.infer<typeof updateReportSchema>
  ) {
    return prisma.medicalReport.update({
      where: { id: reportId },
      data,
    });
  }

  static async delete(reportId: string) {
    return prisma.medicalReport.delete({
      where: { id: reportId },
    });
  }

  static async generatePdf(
    reportId: string,
    clinicId: string
  ): Promise<Buffer> {
    const report = await this.findById(reportId);
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      include: { address: true },
    });

    const pdfBuffer = await this._generatePDFFromHTML(
      report.content,
      clinic,
      "Laudo Médico"
    );

    return pdfBuffer;
  }

  private static async _generatePDFFromHTML(
    content: string,
    clinic: any,
    documentTitle: string
  ): Promise<Buffer> {
    const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
      <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
      ${
        clinic.address
          ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>`
          : ""
      }
      <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
    </div>
  `;

    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 2cm 1.5cm;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

    const pdfBuffer = await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
      margin: { top: "120px", bottom: "60px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }
}

```

# patient.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  CreatePatientInput,
  UpdatePatientInput,
} from "../schemas/patient.schema";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

export class PatientService {
  static async create(clinicId: string, data: CreatePatientInput) {
    const { address, phones, ...patientData } = data;

    return prisma.$transaction(async (tx) => {
      const newAddress = await tx.address.create({
        data: address,
      });

      const newPatient = await tx.patient.create({
        data: {
          ...patientData,
          birthDate: new Date(patientData.birthDate),
          guardianBirthDate: patientData.guardianBirthDate
            ? new Date(patientData.guardianBirthDate)
            : null,
          clinicId,
          maritalStatus: patientData.maritalStatus,
          addressId: newAddress.id,
        },
      });

      await tx.phone.createMany({
        data: phones.map((phone) => ({
          ...phone,
          patientId: newPatient.id,
        })),
      });

      return newPatient;
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    document?: string
  ) {
    const where: Prisma.PatientWhereInput = { clinicId };

    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (document) {
      where.OR = [
        { cpf: { contains: document } },
        { identityCard: { contains: document } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [patients, totalCount] = await prisma.$transaction([
      prisma.patient.findMany({
        where,
        include: {
          clinic: { select: { name: true } },
          phones: { take: 1 },
        },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.patient.count({ where }),
    ]);

    return { patients, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.patient.findFirst({
      where: { id, clinicId },
      include: {
        address: true,
        phones: true,
        trafficSource: true,
        treatmentPlans: {
          orderBy: { createdAt: "desc" },
          include: {
            seller: { select: { fullName: true } },
            procedures: {
              include: {
                procedure: { select: { name: true } },
              },
            },
          },
        },
        appointments: {
          orderBy: { date: "desc" },
          include: {
            appointmentType: { select: { name: true } },
            professional: { select: { fullName: true } },
          },
        },
        assessments: {
          orderBy: { createdAt: "desc" },
          include: {
            template: { select: { name: true } },
            appointment: {
              select: {
                id: true,
                date: true,
                appointmentType: { select: { name: true } },
                professional: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
  }

  static async update(id: string, clinicId: string, data: UpdatePatientInput) {
    const { address, phones, ...patientData } = data;

    const existingPatient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
      select: { addressId: true },
    });

    return prisma.$transaction(async (tx) => {
      if (address && existingPatient.addressId) {
        await tx.address.update({
          where: { id: existingPatient.addressId },
          data: address,
        });
      }

      if (phones) {
        await tx.phone.deleteMany({ where: { patientId: id } });
        await tx.phone.createMany({
          data: phones.map((phone) => ({ ...phone, patientId: id })),
        });
      }

      const updatedPatient = await tx.patient.update({
        where: { id },
        data: {
          ...patientData,
          birthDate: patientData.birthDate
            ? new Date(patientData.birthDate)
            : undefined,
          guardianBirthDate: patientData.guardianBirthDate
            ? new Date(patientData.guardianBirthDate)
            : undefined,
        },
      });
      return updatedPatient;
    });
  }

  static async delete(id: string, clinicId: string) {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
      select: { addressId: true },
    });

    return prisma.$transaction(async (tx) => {
      await tx.patient.delete({ where: { id } });

      if (patient.addressId) {
        await tx.address.delete({ where: { id: patient.addressId } });
      }
    });
  }

  static async importPatients(fileBuffer: Buffer, clinicId: string) {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Converte para JSON
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name =
        row["Nome"] || row["Paciente"] || row["nome"] || row["paciente"];
      const rawCpf = row["CPF"] || row["cpf"] || "";
      const rawPhone =
        row["Telefone"] ||
        row["telefone"] ||
        row["Celular"] ||
        row["celular"] ||
        "";

      if (!name) {
        results.errors.push(`Linha ${rowNum}: Nome é obrigatório.`);
        continue;
      }

      // Tratamento de CPF
      const cpf = rawCpf.toString().replace(/\D/g, "");

      if (cpf.length !== 11) {
        results.errors.push(
          `Linha ${rowNum}: CPF inválido ou vazio (${name}).`
        );
        continue;
      }

      // Verifica duplicidade
      const existing = await prisma.patient.findFirst({
        where: { cpf, clinicId },
      });

      if (existing) {
        results.errors.push(`Linha ${rowNum}: CPF já cadastrado (${name}).`);
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Cria Paciente (sem endereço, pois não vem na planilha simples)
          const newPatient = await tx.patient.create({
            data: {
              name,
              cpf,
              birthDate: new Date(), // Fallback: define hoje ou deixe null se seu schema permitir (seu schema exige DateTime)
              // Se birthDate for obrigatório e não vier na planilha, definimos uma data padrão ou 01/01/1900
              // Idealmente a planilha deveria ter "Data de Nascimento"
              clinicId,
            },
          });

          // Cria Telefone se existir
          if (rawPhone) {
            const phoneClean = rawPhone.toString().replace(/\D/g, "");
            await tx.phone.create({
              data: {
                number: phoneClean,
                isWhatsapp: true, // Assume true por padrão na importação
                patientId: newPatient.id,
              },
            });
          }
        });
        results.success++;
      } catch (error) {
        console.error(error);
        results.errors.push(`Linha ${rowNum}: Erro ao salvar no banco.`);
      }
    }

    return results;
  }
}

```

# paymentInstallment.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  Prisma,
  PaymentStatus,
  CommissionTriggerEvent,
  TransactionType,
} from "@prisma/client";
import { RegisterPaymentInput } from "../schemas/paymentInstallment.schema";
import { CommissionRecordService } from "./commissionRecord.service";

export class PaymentInstallmentService {
  /**
   * Registra o pagamento de uma parcela, lida com pagamentos parciais
   * e dispara o cálculo de comissão de acordo com a regra do plano.
   */
  static async registerPayment(
    id: string,
    clinicId: string,
    data: RegisterPaymentInput
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Busca Parcela e Plano
      const installment = await tx.paymentInstallment.findFirstOrThrow({
        where: { id, clinicId },
        include: {
          treatmentPlan: {
            include: {
              seller: { include: { CommissionPlan: true } },
              _count: { select: { paymentInstallments: true } },
              patient: { select: { name: true } }, // Adicionado para a msg de erro
            },
          },
        },
      });

      // Validações Iniciais
      if (installment.status === PaymentStatus.CANCELED) {
        throw new Error(
          "Parcela está cancelada e não pode receber pagamentos."
        );
      }
      if (installment.status === PaymentStatus.PAID) {
        throw new Error("Parcela já consta como totalmente paga."); // Mensagem mais clara
      }

      // 2. Lógica de Pagamento Parcial e Status - Refatorada
      const currentPaidAmount = Number(installment.paidAmount || 0);
      const newlyPaidAmount = Number(data.paidAmount);
      const totalPaid = currentPaidAmount + newlyPaidAmount;
      const amountDue = Number(installment.amountDue);
      const isOverdue = installment.dueDate < new Date(); // Verifica se já estava vencida

      let newStatus: PaymentStatus;

      if (totalPaid >= amountDue) {
        newStatus = PaymentStatus.PAID; // Quitada!
      } else if (totalPaid > 0) {
        // Se pagou algo mas não quitou, mantém PENDING ou OVERDUE
        newStatus = isOverdue ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
      } else {
        // Se o total pago for zero ou menos (ex: estorno?), volta ao status original baseado na data
        newStatus = isOverdue ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
      }

      // Variáveis para lógica de comissão
      const isFirstPaymentForThisInstallment =
        currentPaidAmount === 0 && newlyPaidAmount > 0;
      // Verifica se a parcela foi quitada NESTE pagamento (transição de !PAID para PAID)
      const isNowFullyPaid =
        newStatus === PaymentStatus.PAID &&
        (installment.status as PaymentStatus) !== PaymentStatus.PAID;

      // 3. Atualiza a Parcela
      const updatedInstallment = await tx.paymentInstallment.update({
        where: { id },
        data: {
          status: newStatus,
          paidAmount: new Prisma.Decimal(totalPaid.toFixed(2)), // Salva o total pago acumulado
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      });

      if (newlyPaidAmount > 0) {
        // 4. VERIFICAR SE O CAIXA DE DESTINO ESTÁ ABERTO
        const activeSession = await tx.cashRegisterSession.findFirst({
          where: {
            bankAccountId: data.bankAccountId,
            status: "OPEN",
          },
        });

        // 5. REGRA DE NEGÓCIO: Se o caixa estiver fechado, BLOQUEAR.
        if (!activeSession) {
          const bankAccount = await tx.bankAccount.findUnique({
            where: { id: data.bankAccountId },
            select: { name: true },
          });
          throw new Error(
            `CAIXA FECHADO: Não é possível registrar este pagamento pois o caixa "${
              bankAccount?.name || "desconhecido"
            }" está fechado. Abra o caixa primeiro.`
          );
        }

        // 6. Se estiver aberto, criar a transação VINCULADA à sessão
        await tx.financialTransaction.create({
          data: {
            clinicId: clinicId,
            description: `Recebimento Parcela ${
              installment.installmentNumber
            } - ${
              installment.treatmentPlan?.patient?.name ??
              "Paciente Desconhecido"
            }`,
            amount: new Prisma.Decimal(newlyPaidAmount.toFixed(2)),
            type: TransactionType.REVENUE,
            date: new Date(data.paymentDate),
            bankAccountId: data.bankAccountId,
            paymentInstallmentId: updatedInstallment.id,
            // Vincula obrigatoriamente à sessão ativa
            cashRegisterSessionId: activeSession.id,
          },
        });

        // 7. Atualizar o saldo da BankAccount (INCREMENTAR)
        await tx.bankAccount.update({
          where: { id: data.bankAccountId },
          data: { balance: { increment: newlyPaidAmount } },
        });
        console.log(
          `Saldo da conta ${data.bankAccountId} incrementado em ${newlyPaidAmount}.`
        );
      }

      // --- LÓGICA REFINADA PARA DISPARAR COMISSÃO ---
      const commissionPlan = installment.treatmentPlan?.seller?.CommissionPlan;
      const triggerEvent = commissionPlan?.triggerEvent;

      let shouldCalculateCommission = false;
      let installmentIdForCommission: string | undefined =
        updatedInstallment.id;

      switch (triggerEvent) {
        case CommissionTriggerEvent.ON_SALE:
          console.log("Comissão ON_SALE, não dispara no pagamento.");
          break;

        case CommissionTriggerEvent.ON_FIRST_INSTALLMENT_PAID: {
          // <-- Adiciona Chaves {}
          const anyPreviousPayment = await tx.paymentInstallment.findFirst({
            where: {
              treatmentPlanId: installment.treatmentPlanId,
              paidAmount: { gt: 0 },
              id: { not: updatedInstallment.id },
            },
          });
          if (isFirstPaymentForThisInstallment && !anyPreviousPayment) {
            console.log(
              `Disparando comissão ON_FIRST_INSTALLMENT_PAID para plano ${installment.treatmentPlanId}`
            );
            shouldCalculateCommission = true;
            installmentIdForCommission = undefined;
          }
          break;
        } // <-- Fecha Chaves {}

        case CommissionTriggerEvent.ON_FULL_PLAN_PAID: {
          // <-- Adiciona Chaves {}
          if (isNowFullyPaid) {
            const totalInstallmentsCount =
              installment.treatmentPlan?._count?.paymentInstallments ?? 0;
            const paidInstallmentsCount = await tx.paymentInstallment.count({
              where: {
                treatmentPlanId: installment.treatmentPlanId,
                status: PaymentStatus.PAID,
              },
            });
            if (
              totalInstallmentsCount > 0 &&
              paidInstallmentsCount === totalInstallmentsCount
            ) {
              console.log(
                `Disparando comissão ON_FULL_PLAN_PAID para plano ${installment.treatmentPlanId}`
              );
              shouldCalculateCommission = true;
              installmentIdForCommission = undefined;
            } else {
              console.log(
                `Plano ${installment.treatmentPlanId} quitou parcela ${id}, mas ainda não está totalmente pago (${paidInstallmentsCount}/${totalInstallmentsCount}).`
              );
            }
          }
          break;
        } // <-- Fecha Chaves {}

        case CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID:
          if (isNowFullyPaid) {
            console.log(
              `Disparando comissão ON_EACH_INSTALLMENT_PAID para parcela ${updatedInstallment.id}`
            );
            shouldCalculateCommission = true;
            // Mantém installmentIdForCommission com o ID da parcela
          }
          break;

        default:
          console.log(
            "Nenhum gatilho de comissão configurado ou reconhecido para o vendedor."
          );
      }

      // Dispara o cálculo se necessário
      if (shouldCalculateCommission && installment.treatmentPlanId) {
        try {
          await CommissionRecordService.calculateAndRecordCommissionForPlan(
            tx,
            installment.treatmentPlanId,
            installmentIdForCommission
          );
          console.log(`Cálculo de comissão processado para ${triggerEvent}.`);
        } catch (commissionError: any) {
          console.error(
            `Erro ao calcular/registrar comissão ${triggerEvent}:`,
            commissionError.message
          );
          // throw commissionError; // Descomente se a falha na comissão deve reverter o pagamento
        }
      }
      // --- FIM DA LÓGICA REFINADA ---

      return updatedInstallment;
    });
  }

  /**
   * Lista as parcelas com filtros e paginação.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: PaymentStatus[];
      dueDateStart?: string;
      dueDateEnd?: string;
      patientName?: string;
      treatmentPlanId?: string;
    }
  ) {
    const where: Prisma.PaymentInstallmentWhereInput = { clinicId };
    const now = new Date();

    // Lógica de Status
    if (filters.status && filters.status.length > 0) {
      const directStatuses = filters.status.filter(
        (s) => s !== PaymentStatus.OVERDUE
      );
      const conditions: Prisma.PaymentInstallmentWhereInput[] = [];
      if (directStatuses.length > 0)
        conditions.push({ status: { in: directStatuses } });
      if (filters.status.includes(PaymentStatus.OVERDUE)) {
        conditions.push({
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        });
      }
      // Se NENHUM status direto foi selecionado E OVERDUE foi, ajusta a query
      // para pegar apenas PENDING+Vencido, senão pega (Status Diretos OU (PENDING+Vencido))
      if (
        directStatuses.length === 0 &&
        filters.status.includes(PaymentStatus.OVERDUE)
      ) {
        where.status = PaymentStatus.PENDING;
        where.dueDate = { lt: now };
      } else if (conditions.length > 0) {
        where.OR = conditions;
      }
    }

    // Filtros de Data
    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = { ...(where.dueDate as Prisma.DateTimeFilter) }; // Mantém filtro de OVERDUE se existir
      if (filters.dueDateStart)
        where.dueDate.gte = new Date(filters.dueDateStart);
      if (filters.dueDateEnd) where.dueDate.lte = new Date(filters.dueDateEnd);
    }

    // Filtro por Nome do Paciente
    if (filters.patientName) {
      // Combina com o filtro de clinicId existente
      where.treatmentPlan = {
        ...(where.treatmentPlan as Prisma.TreatmentPlanListRelationFilter), // Mantém outros filtros se houver
        patient: {
          name: { contains: filters.patientName, mode: "insensitive" },
        },
      };
    } else if (filters.treatmentPlanId) {
      where.treatmentPlanId = filters.treatmentPlanId;
    }

    const skip = (page - 1) * pageSize;
    const [installments, totalCount] = await prisma.$transaction([
      prisma.paymentInstallment.findMany({
        where,
        include: {
          treatmentPlan: {
            select: {
              id: true,
              patient: { select: { id: true, name: true } },
              _count: { select: { paymentInstallments: true } },
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { dueDate: "asc" },
      }),
      prisma.paymentInstallment.count({ where }),
    ]);

    // Adiciona o status 'OVERDUE' dinamicamente
    const installmentsWithStatus = installments.map((inst) => ({
      ...inst,
      status:
        inst.status === PaymentStatus.PENDING && inst.dueDate < now
          ? PaymentStatus.OVERDUE
          : inst.status,
    }));

    return { data: installmentsWithStatus, totalCount };
  }

  /**
   * Busca uma parcela específica pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.paymentInstallment.findFirst({
      where: { id, clinicId },
      include: {
        treatmentPlan: {
          select: {
            id: true,
            patient: { select: { id: true, name: true } },
            _count: { select: { paymentInstallments: true } },
          },
        },
      },
    });
  }
}

```

# pdf.service.ts

```ts
// src/services/pdf.service.ts
import puppeteer from "puppeteer-core";
import os from "os";
import fs from "fs";

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];

export class PdfService {
  static readonly commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--disable-extensions",
    "--disable-gpu",
  ];

  private static findChromeExecutable(): string | null {
    if (process.env.CHROME_EXECUTABLE_PATH) {
      return process.env.CHROME_EXECUTABLE_PATH;
    }

    const platform = os.platform();
    const candidates: string[] =
      platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : platform === "win32"
        ? [
            // common windows locations
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : [
            // linux common locations
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
          ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  private static async getLaunchOptions(): Promise<LaunchOptions> {
    const isProduction = process.env.NODE_ENV === "production";
    const executablePath = this.findChromeExecutable();

    if (!executablePath) {
      throw new Error(
        "Chrome/Chromium executable not found. Install Chromium on the VPS or set CHROME_EXECUTABLE_PATH. " +
          "If you prefer Puppeteer bundled Chromium, install 'puppeteer' (npm i puppeteer)."
      );
    }

    const opts: LaunchOptions = {
      executablePath,
      headless: true,
      args: this.commonArgs,
    };

    if (isProduction) {
      opts.headless = true;
      opts.args = [...(opts.args ?? []), "--no-zygote"];
    }

    return opts;
  }

  static async generatePdfFromHtml(
    html: string,
    options?: {
      format?: "A4" | "Letter";
      margin?: { top?: string; bottom?: string; left?: string; right?: string };
      headerTemplate?: string;
      footerTemplate?: string;
      displayHeaderFooter?: boolean;
    }
  ): Promise<Buffer> {
    const launchOptions = await this.getLaunchOptions();
    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: options?.format ?? "A4",
        printBackground: true,
        displayHeaderFooter: options?.displayHeaderFooter ?? false,
        headerTemplate: options?.headerTemplate,
        footerTemplate: options?.footerTemplate,
        margin: options?.margin,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
export default PdfService;

```

# prescription.service.ts

```ts
import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
} from "../schemas/prescription.schema";
import PdfService from "./pdf.service";

export class PrescriptionService {
  static async create(data: z.infer<typeof createPrescriptionSchema>) {
    return prisma.prescription.create({
      data,
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findByPatientId(patientId: string) {
    return prisma.prescription.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findById(prescriptionId: string) {
    return prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
    });
  }

  static async update(
    prescriptionId: string,
    data: z.infer<typeof updatePrescriptionSchema>
  ) {
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data,
    });
  }

  static async delete(prescriptionId: string) {
    return prisma.prescription.delete({
      where: { id: prescriptionId },
    });
  }

  static async generatePdf(
    prescriptionId: string,
    clinicId: string
  ): Promise<Buffer> {
    const prescription = await this.findById(prescriptionId);
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      include: { address: true },
    });

    const pdfBuffer = await this._generatePDFFromHTML(
      prescription.content,
      clinic,
      "Receituário"
    );

    return pdfBuffer;
  }

  private static async _generatePDFFromHTML(
    content: string,
    clinic: any,
    documentTitle: string
  ): Promise<Buffer> {
    const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
      <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
      ${
        clinic.address
          ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>`
          : ""
      }
      <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
    </div>
  `;

    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 2cm 1.5cm;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

    const pdfBuffer = await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
      margin: { top: "120px", bottom: "60px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }
}

```

# product.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductInput,
  UpdateProductInput,
} from "../schemas/product.schema";

export class ProductService {
  /**
   * Cria um novo produto, validando se a categoria e marca pertencem à clínica.
   */
  static async create(data: CreateProductInput, clinicId: string) {
    const { categoryId, brandId } = data;

    return prisma.$transaction(async (tx) => {
      await tx.productCategory.findFirstOrThrow({
        where: { id: categoryId, clinicId },
      });
      await tx.productBrand.findFirstOrThrow({
        where: { id: brandId, clinicId },
      });

      const product = await tx.product.create({
        data: {
          ...data,
          clinicId,
        },
      });

      return product;
    });
  }

  /**
   * Lista os produtos da clínica com paginação e filtros.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    sku?: string
  ) {
    const where: Prisma.ProductWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (sku) {
      where.sku = { contains: sku, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [products, totalCount] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          stockMovements: {
            where: { type: "ENTRY" },
            select: {
              id: true,
              expiryDate: true,
              type: true,
              quantity: true,
              date: true,
              invoiceNumber: true,
            },
            orderBy: { date: "desc" },
          },
        },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where }),
    ]);

    return { data: products, totalCount };
  }

  /**
   * Busca um produto específico pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.product.findFirst({
      where: { id, clinicId },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Atualiza um produto, validando as chaves estrangeiras se forem alteradas.
   */
  static async update(id: string, data: UpdateProductInput, clinicId: string) {
    const { categoryId, brandId } = data;

    return prisma.$transaction(async (tx) => {
      // Garante que o produto a ser atualizado pertence à clínica
      await tx.product.findFirstOrThrow({ where: { id, clinicId } });

      // Se a categoria for alterada, valida a nova categoria
      if (categoryId) {
        await tx.productCategory.findFirstOrThrow({
          where: { id: categoryId, clinicId },
        });
      }
      // Se a marca for alterada, valida a nova marca
      if (brandId) {
        await tx.productBrand.findFirstOrThrow({
          where: { id: brandId, clinicId },
        });
      }

      return tx.product.update({
        where: { id },
        data,
      });
    });
  }

  /**
   * Deleta um produto, verificando antes se ele possui movimentações de estoque.
   */
  static async delete(id: string, clinicId: string) {
    await prisma.product.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Impede a exclusão se o produto tiver histórico de movimentação.
    const movementCount = await prisma.stockMovement.count({
      where: { productId: id },
    });

    if (movementCount > 0) {
      throw new Error("PRODUCT_IN_USE");
    }

    return prisma.product.delete({ where: { id } });
  }
}

```

# productBrand.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductBrandInput,
  UpdateProductBrandInput,
} from "../schemas/productBrand.schema";

export class ProductBrandService {
  static async create(data: CreateProductBrandInput, clinicId: string) {
    return prisma.productBrand.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.ProductBrandWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [brands, totalCount] = await prisma.$transaction([
      prisma.productBrand.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.productBrand.count({ where }),
    ]);

    return { data: brands, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.productBrand.findFirst({
      where: { id, clinicId },
    });
  }

  static async update(
    id: string,
    data: UpdateProductBrandInput,
    clinicId: string
  ) {
    await prisma.productBrand.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.productBrand.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.productBrand.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se a marca estiver em uso.
    const productCount = await prisma.product.count({
      where: { brandId: id },
    });

    if (productCount > 0) {
      throw new Error("BRAND_IN_USE");
    }

    return prisma.productBrand.delete({ where: { id } });
  }
}

```

# productCategory.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
} from "../schemas/productCategory.schema";

export class ProductCategoryService {
  /**
   * Cria uma nova categoria de produto associada a uma clínica.
   */
  static async create(data: CreateProductCategoryInput, clinicId: string) {
    return prisma.productCategory.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  /**
   * Lista todas as categorias de uma clínica com paginação e filtro por nome.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.ProductCategoryWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [categories, totalCount] = await prisma.$transaction([
      prisma.productCategory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return { data: categories, totalCount };
  }

  /**
   * Busca uma categoria específica pelo ID, garantindo que pertença à clínica.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.productCategory.findFirst({
      where: { id, clinicId },
    });
  }

  /**
   * Atualiza uma categoria, garantindo que ela pertença à clínica.
   */
  static async update(
    id: string,
    data: UpdateProductCategoryInput,
    clinicId: string
  ) {
    // Garante que o registro a ser atualizado pertence à clínica do usuário logado
    await prisma.productCategory.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.productCategory.update({
      where: { id },
      data,
    });
  }

  /**
   * Deleta uma categoria, mas antes verifica se ela não está sendo usada por nenhum produto.
   */
  static async delete(id: string, clinicId: string) {
    // Garante que a categoria existe e pertence à clínica
    const category = await prisma.productCategory.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se a categoria estiver em uso.
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      // Lança um erro específico que o controller pode capturar
      throw new Error("CATEGORY_IN_USE");
    }

    return prisma.productCategory.delete({ where: { id } });
  }
}

```

# professionalCouncil.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  CreateProfessionalCouncilInput,
  UpdateProfessionalCouncilInput,
} from "../schemas/professionalCouncil.schema";
import { Prisma } from "@prisma/client";

export class ProfessionalCouncilService {
  // CORREÇÃO: Ordem dos parâmetros ajustada para (data, clinicId)
  static async create(data: CreateProfessionalCouncilInput, clinicId: string) {
    return prisma.professionalCouncil.create({
      data: { ...data, clinicId },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    // Filtra: Da clínica OU Global (null)
    const where: Prisma.ProfessionalCouncilWhereInput = {
      OR: [{ clinicId: clinicId }, { clinicId: null }],
    };

    if (name) {
      // AND para combinar a busca por nome com o filtro de tenancy
      where.AND = [{ name: { contains: name, mode: "insensitive" } }];
    }

    const skip = (page - 1) * pageSize;
    const [data, totalCount] = await prisma.$transaction([
      prisma.professionalCouncil.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.professionalCouncil.count({ where }),
    ]);

    return { data, totalCount };
  }

  // CORREÇÃO: Adicionado clinicId para verificar permissão de visualização
  static async getById(id: string, clinicId: string) {
    return prisma.professionalCouncil.findFirst({
      where: {
        id,
        OR: [{ clinicId: clinicId }, { clinicId: null }],
      },
    });
  }

  // CORREÇÃO: Adicionado clinicId para garantir que só edita o próprio registro
  static async update(
    id: string,
    data: UpdateProfessionalCouncilInput,
    clinicId: string
  ) {
    // Garante que o registro pertence à clínica antes de atualizar
    await prisma.professionalCouncil.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.professionalCouncil.update({
      where: { id },
      data,
    });
  }

  // CORREÇÃO: Adicionado clinicId para garantir que só deleta o próprio registro
  static async delete(id: string, clinicId: string) {
    // Garante que o registro pertence à clínica antes de deletar
    await prisma.professionalCouncil.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.professionalCouncil.delete({ where: { id } });
  }
}

```

# report.service.ts

```ts
// src/services/report.service.ts
import { prisma } from "../lib/prisma";
import PdfService from "./pdf.service";
import {
  Appointment,
  Clinic,
  CommissionRecord,
  CommissionStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Product,
  StockMovementType,
  TransactionType,
  TreatmentPlan,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { differenceInDays, format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  accountsPayableReportQuerySchema,
  accountsReceivableReportQuerySchema,
  appointmentsReportQuerySchema,
  attendedPatientsReportQuerySchema,
  cashStatementReportQuerySchema,
  commissionReportQuerySchema,
  expiredProductsReportQuerySchema,
  inactivePatientsReportQuerySchema,
  paymentMethodsReportQuerySchema,
  professionalValueReportQuerySchema,
  salesReportQuerySchema,
  stockAvailabilityReportQuerySchema,
  stockMovementReportQuerySchema,
} from "../schemas/report.schema";
import z from "zod";

// ===================================================================================
// TIPOS E INTERFACES AUXILIARES
// ===================================================================================

type AppointmentWithIncludes = Appointment & {
  professional: { fullName: string };
  patient: { name: string };
  appointmentType: { name: string };
  treatmentPlan:
    | (TreatmentPlan & {
        paymentInstallments: {
          status: PaymentStatus;
        }[];
      })
    | null;
};

type ReportFilters = z.infer<typeof appointmentsReportQuerySchema>;
type ProfessionalValueReportFilters = z.infer<
  typeof professionalValueReportQuerySchema
>;

type FlatProfessionalValueData = {
  patientName: string;
  specialtyName: string;
  procedureName: string;
  procedureValue: Decimal;
  dueDate: Date;
  paymentDate: Date | null;
  paidAmount: Decimal;
  paymentMethod: PaymentMethod | null;
  installmentInfo: string;
};

type CommissionReportFilters = z.infer<typeof commissionReportQuerySchema>;

type CommissionRecordWithIncludes = CommissionRecord & {
  professional: { fullName: string };
  treatmentPlan: {
    total: Decimal;
    patient: { name: string };
  };
};

type AttendedPatientsReportFilters = z.infer<
  typeof attendedPatientsReportQuerySchema
>;

type ProcessedPatient = {
  name: string;
  cpf: string;
  phone: string;
  specialty: string;
};

type ProductWithCost = Product & {
  category: { name: string };
  unitCost: Decimal;
  totalValue: Decimal;
};

type ProcessedInactivePatient = {
  name: string;
  phone: string;
  lastAppointment: Date;
  daysInactive: number;
};

// ===================================================================================
// CLASSE PRINCIPAL DO SERVIÇO
// ===================================================================================

export class ReportService {
  // =================================================================================
  // PARTE A: Helpers Privados (Formatação e Reutilizáveis)
  // =================================================================================

  /**
   * Gera o template do Cabeçalho do PDF
   */
  private static getPdfHeader(clinicName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 10px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
        <h1 style="margin: 0; font-size: 14px;">${clinicName}</h1>
      </div>
    `;
  }

  /**
   * Gera o template do Rodapé do PDF
   */
  private static getPdfFooter(): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: right; width: 100%; padding: 0 20px;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>
    `;
  }

  /**
   * Helper para formatar moeda
   */
  private static formatCurrency(value: number | Decimal): string {
    const numValue = typeof value === "number" ? value : value.toNumber();
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  }

  /**
   * Helper para formatar Forma de Pagamento
   */
  private static formatPaymentMethod(method: PaymentMethod | null): string {
    if (!method) return "Não Registrado";
    switch (method) {
      case "CREDIT_CARD":
        return "Cartão de Crédito";
      case "DEBIT_CARD":
        return "Cartão de Débito";
      case "BANK_TRANSFER":
        return "PIX / Transf.";
      case "CASH":
        return "Dinheiro";
      case "CHECK":
        return "Cheque";
      case "OTHER":
        return "Outro";
      default:
        return "N/A";
    }
  }

  /**
   * Helper para formatar Status de Pagamento (Parcela/Despesa)
   */
  private static formatPaymentStatus(status: PaymentStatus): string {
    switch (status) {
      case "PENDING":
        return "A Vencer";
      case "OVERDUE":
        return "Vencido";
      case "PAID":
        return "Pago";
      case "CANCELED":
        return "Cancelado";
      default:
        return "N/A";
    }
  }

  /**
   * Helper para formatar Status da Comissão
   */
  private static formatCommissionStatus(status: CommissionStatus): string {
    switch (status) {
      case "PAID":
        return "Paga";
      case "PENDING":
        return "Pendente";
      case "CANCELED":
        return "Cancelada";
      default:
        return "N/A";
    }
  }

  /**
   * Helper para formatar Tipo de Transação Financeira
   */
  private static formatTransactionType(type: TransactionType): string {
    switch (type) {
      case "REVENUE":
        return "Entrada (Receita)";
      case "EXPENSE":
        return "Saída (Despesa)";
      case "TRANSFER":
        return "Transferência";
      default:
        return type;
    }
  }

  /**
   * Helper para formatar CPF
   */
  private static formatCpf(cpf: string | null | undefined): string {
    if (!cpf) return "N/A";
    // Formata XXX.XXX.XXX-XX
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  /**
   * Helper para formatar Telefone
   */
  private static formatPhone(phone: string | null | undefined): string {
    if (!phone) return "N/A";
    // Tenta formatar (XX) XXXXX-XXXX
    if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    // Tenta formatar (XX) XXXX-XXXX
    if (phone.length === 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone; // Retorna original se não bater
  }

  /**
   * Helper para derivar status de pagamento do plano (baseado em agendamentos)
   */
  private static getPlanPaymentStatus(
    plan: AppointmentWithIncludes["treatmentPlan"]
  ): string {
    if (!plan) return "N/A";
    const installments = plan.paymentInstallments;
    if (!installments || installments.length === 0) return "Pendente";

    const allPaid = installments.every((i) => i.status === "PAID");
    if (allPaid) return "Pago";

    const someOverdue = installments.some((i) => i.status === "OVERDUE");
    if (someOverdue) return "Vencido";

    const somePaid = installments.some((i) => i.status === "PAID");
    if (somePaid) return "Parcial";

    return "Pendente";
  }

  /**
   * Helper para encontrar o custo unitário de um produto
   * (Baseado na última entrada com valor)
   */
  private static async getProductUnitCost(
    tx: Prisma.TransactionClient,
    productId: string
  ): Promise<Decimal> {
    const lastEntry = await tx.stockMovement.findFirst({
      where: {
        productId,
        type: StockMovementType.ENTRY,
        totalValue: { not: null, gt: 0 },
        quantity: { gt: 0 },
      },
      orderBy: { date: "desc" },
    });

    if (!lastEntry || !lastEntry.totalValue) {
      return new Decimal(0);
    }
    return lastEntry.totalValue.dividedBy(lastEntry.quantity);
  }

  // =================================================================================
  // PARTE B: Geradores de Relatório (Públicos)
  // =================================================================================

  /**
   * 1. Relatório de Atendimentos
   */
  static async generateAppointmentsReport(
    clinicId: string,
    filters: ReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, taxId: true, address: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const appointments = (await prisma.appointment.findMany({
      where: {
        patient: { clinicId },
        date: { gte: startDateObj, lte: endDateObj },
        professionalId: professionalId || undefined,
      },
      include: {
        professional: { select: { fullName: true } },
        patient: { select: { name: true } },
        appointmentType: { select: { name: true } },
        treatmentPlan: {
          select: {
            id: true,
            total: true,
            paymentInstallments: { select: { status: true } },
          },
        },
      },
      orderBy: [
        { professional: { fullName: "asc" } },
        { date: "asc" },
        { startTime: "asc" },
      ],
    })) as AppointmentWithIncludes[];

    const groupedByProfessional = appointments.reduce((acc, app) => {
      const profName = app.professional.fullName;
      if (!acc[profName]) acc[profName] = [];
      acc[profName].push(app);
      return acc;
    }, {} as Record<string, AppointmentWithIncludes[]>);

    const uniquePlanIds = new Set<string>();
    for (const app of appointments) {
      if (app.treatmentPlanId) uniquePlanIds.add(app.treatmentPlanId);
    }

    let totalValue = 0;
    if (uniquePlanIds.size > 0) {
      const planTotals = await prisma.treatmentPlan.aggregate({
        _sum: { total: true },
        where: { id: { in: Array.from(uniquePlanIds) } },
      });
      totalValue = planTotals._sum.total?.toNumber() || 0;
    }

    const summary = {
      totalAppointments: appointments.length,
      totalValue: totalValue,
    };

    const html = this.getReportHtml(
      clinic,
      groupedByProfessional,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 2. Relatório de Valor por Profissional
   */
  static async generateProfessionalValueReport(
    clinicId: string,
    filters: ProfessionalValueReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    const professional = await prisma.user.findUnique({
      where: { id: professionalId },
      select: { fullName: true },
    });
    if (!clinic || !professional) {
      throw new Error("Clínica ou profissional não encontrado.");
    }

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const installments = await prisma.paymentInstallment.findMany({
      where: {
        clinicId: clinicId,
        status: "PAID",
        paymentDate: { gte: startDateObj, lte: endDateObj },
        treatmentPlan: { sellerId: professionalId },
      },
      include: {
        treatmentPlan: {
          include: {
            patient: { select: { name: true } },
            procedures: {
              include: {
                procedure: {
                  include: { specialty: { select: { name: true } } },
                },
              },
            },
            _count: {
              select: { paymentInstallments: true },
            },
          },
        },
      },
      orderBy: { paymentDate: "asc" },
    });

    const flattenedData: FlatProfessionalValueData[] = [];
    let totalPaid = new Decimal(0);
    const patientSet = new Set<string>();

    for (const installment of installments) {
      if (!installment.paidAmount) continue;
      totalPaid = totalPaid.add(installment.paidAmount);
      patientSet.add(installment.treatmentPlan.patient.name);
      const currentInstallment = installment.installmentNumber;
      const totalInstallments =
        installment.treatmentPlan._count.paymentInstallments;
      const installmentInfo = `${currentInstallment}/${totalInstallments}`;

      for (const planProcedure of installment.treatmentPlan.procedures) {
        flattenedData.push({
          patientName: installment.treatmentPlan.patient.name,
          specialtyName: planProcedure.procedure.specialty.name,
          procedureName: planProcedure.procedure.name,
          procedureValue: planProcedure.unitPrice,
          dueDate: installment.dueDate,
          paymentDate: installment.paymentDate,
          paidAmount: installment.paidAmount,
          paymentMethod: installment.paymentMethod,
          installmentInfo: installmentInfo,
        });
      }
    }

    const summary = {
      totalValuePaid: totalPaid.toNumber(),
      totalPatients: patientSet.size,
    };

    const html = this.getProfessionalValueReportHtml(
      clinic,
      professional.fullName,
      flattenedData,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 3. Relatório de Comissão do Vendedor
   */
  static async generateCommissionReport(
    clinicId: string,
    filters: CommissionReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    const professional = await prisma.user.findUnique({
      where: { id: professionalId },
      select: { fullName: true },
    });
    if (!clinic || !professional) {
      throw new Error("Clínica ou profissional não encontrado.");
    }

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const records = (await prisma.commissionRecord.findMany({
      where: {
        clinicId: clinicId,
        professionalId: professionalId,
        calculationDate: { gte: startDateObj, lte: endDateObj },
      },
      include: {
        professional: { select: { fullName: true } },
        treatmentPlan: {
          select: {
            total: true,
            patient: { select: { name: true } },
          },
        },
      },
      orderBy: { calculationDate: "asc" },
    })) as CommissionRecordWithIncludes[];

    let totalPending = new Decimal(0);
    let totalPaid = new Decimal(0);

    for (const record of records) {
      if (record.status === CommissionStatus.PAID) {
        totalPaid = totalPaid.add(record.calculatedAmount);
      } else if (record.status === CommissionStatus.PENDING) {
        totalPending = totalPending.add(record.calculatedAmount);
      }
    }

    const summary = {
      totalPending: totalPending.toNumber(),
      totalPaid: totalPaid.toNumber(),
      totalOverall: totalPending.add(totalPaid).toNumber(),
    };

    const html = this.getCommissionReportHtml(
      clinic,
      professional.fullName,
      records,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 4. Relatório de Pacientes Atendidos
   */
  static async generateAttendedPatientsReport(
    clinicId: string,
    filters: AttendedPatientsReportFilters
  ) {
    const { startDate, endDate, professionalId, specialtyId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    const professional = professionalId
      ? await prisma.user.findUnique({
          where: { id: professionalId },
          select: { fullName: true },
        })
      : null;
    const specialty = specialtyId
      ? await prisma.specialty.findUnique({
          where: { id: specialtyId },
          select: { name: true },
        })
      : null;
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.AppointmentWhereInput = {
      patient: { clinicId: clinicId },
      date: { gte: startDateObj, lte: endDateObj },
    };
    if (professionalId) {
      where.professionalId = professionalId;
    }
    if (specialtyId) {
      where.treatmentPlan = {
        procedures: {
          some: { procedure: { specialtyId: specialtyId } },
        },
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            cpf: true,
            phones: {
              select: { number: true },
              take: 1,
              orderBy: { isWhatsapp: "desc" },
            },
          },
        },
        treatmentPlan: {
          select: {
            procedures: {
              select: {
                procedure: {
                  select: { specialty: { select: { name: true } } },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    const uniquePatients = new Map<string, ProcessedPatient>();
    for (const app of appointments) {
      if (!uniquePatients.has(app.patient.id)) {
        const specialtyName =
          app.treatmentPlan?.procedures[0]?.procedure.specialty.name || "N/A";
        uniquePatients.set(app.patient.id, {
          name: app.patient.name,
          cpf: this.formatCpf(app.patient.cpf),
          phone: this.formatPhone(app.patient.phones[0]?.number),
          specialty: specialtyName,
        });
      }
    }

    const patientDataList = Array.from(uniquePatients.values());
    const summary = { totalPatients: uniquePatients.size };

    const html = this.getAttendedPatientsReportHtml(
      clinic,
      professional?.fullName || "Todos",
      specialty?.name || "Todas",
      patientDataList,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 5. Relatório de Contas a Receber
   */
  static async generateAccountsReceivableReport(
    clinicId: string,
    filters: z.infer<typeof accountsReceivableReportQuerySchema>
  ) {
    const { startDate, endDate, status } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.PaymentInstallmentWhereInput = {
      clinicId: clinicId,
      status: status || { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: startDateObj, lte: endDateObj },
    };

    const installments = await prisma.paymentInstallment.findMany({
      where,
      include: {
        treatmentPlan: {
          select: { patient: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    let totalPending = new Decimal(0);
    let totalOverdue = new Decimal(0);
    for (const inst of installments) {
      if (inst.status === "PENDING") {
        totalPending = totalPending.add(inst.amountDue);
      } else if (inst.status === "OVERDUE") {
        totalOverdue = totalOverdue.add(inst.amountDue);
      }
    }
    const summary = {
      totalPending: totalPending.toNumber(),
      totalOverdue: totalOverdue.toNumber(),
      totalOverall: totalPending.add(totalOverdue).toNumber(),
    };

    const html = this.getAccountsReceivableHtml(
      clinic,
      installments,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 6. Relatório de Contas a Pagar
   */
  static async generateAccountsPayableReport(
    clinicId: string,
    filters: z.infer<typeof accountsPayableReportQuerySchema>
  ) {
    const { startDate, endDate, status, categoryId, supplierId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.ExpenseWhereInput = {
      clinicId: clinicId,
      status: status || { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: startDateObj, lte: endDateObj },
      categoryId: categoryId || undefined,
      supplierId: supplierId || undefined,
    };

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    let totalPending = new Decimal(0);
    let totalOverdue = new Decimal(0);
    for (const exp of expenses) {
      if (exp.status === "PENDING") {
        totalPending = totalPending.add(exp.amount);
      } else if (exp.status === "OVERDUE") {
        totalOverdue = totalOverdue.add(exp.amount);
      }
    }
    const summary = {
      totalPending: totalPending.toNumber(),
      totalOverdue: totalOverdue.toNumber(),
      totalOverall: totalPending.add(totalOverdue).toNumber(),
    };

    const html = this.getAccountsPayableHtml(
      clinic,
      expenses,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 7. Relatório de Disponibilidade de Estoque
   */
  static async generateStockAvailabilityReport(
    clinicId: string,
    filters: z.infer<typeof stockAvailabilityReportQuerySchema>
  ) {
    const { categoryId, brandId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const where: Prisma.ProductWhereInput = {
      clinicId,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
    };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const productsWithCost: ProductWithCost[] = [];
    let grandTotalValue = new Decimal(0);

    for (const product of products) {
      const unitCost = await this.getProductUnitCost(prisma, product.id);
      const totalValue = unitCost.times(product.currentStock);

      productsWithCost.push({
        ...product,
        unitCost,
        totalValue,
      });
      grandTotalValue = grandTotalValue.add(totalValue);
    }

    const summary = {
      totalValueInStock: grandTotalValue.toNumber(),
      totalItems: products.reduce((acc, p) => acc + p.currentStock, 0),
    };

    const html = this.getStockAvailabilityHtml(
      clinic,
      productsWithCost,
      summary
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 8. Relatório de Movimentação de Estoque
   */
  static async generateStockMovementReport(
    clinicId: string,
    filters: z.infer<typeof stockMovementReportQuerySchema>
  ) {
    const { startDate, endDate, type, productId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.StockMovementWhereInput = {
      product: { clinicId },
      type,
      date: { gte: startDateObj, lte: endDateObj },
      productId: productId || undefined,
    };

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });

    let totalQuantity = 0;
    let totalValue = new Decimal(0);
    for (const move of movements) {
      totalQuantity += move.quantity;
      if (move.totalValue) {
        totalValue = totalValue.add(move.totalValue);
      }
    }
    const summary = {
      totalQuantity,
      totalValue: totalValue.toNumber(),
    };

    const html = this.getStockMovementHtml(
      clinic,
      movements,
      summary,
      type,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 9. Relatório de Vendas
   */
  static async generateSalesReport(
    clinicId: string,
    filters: z.infer<typeof salesReportQuerySchema>
  ) {
    const { startDate, endDate, sellerId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de fuso horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.TreatmentPlanWhereInput = {
      clinicId,
      createdAt: { gte: startDateObj, lte: endDateObj },
      sellerId: sellerId || undefined,
    };

    const plans = await prisma.treatmentPlan.findMany({
      where,
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        procedures: {
          include: {
            procedure: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalValue = new Decimal(0);
    for (const plan of plans) {
      totalValue = totalValue.add(plan.total);
    }
    const totalSales = plans.length;
    const avgTicket =
      totalSales > 0 ? totalValue.dividedBy(totalSales) : new Decimal(0);

    const topProcedureAgg = await prisma.treatmentPlanProcedure.groupBy({
      by: ["procedureId"],
      where: { treatmentPlan: where },
      _sum: { contractedSessions: true },
      orderBy: {
        _sum: { contractedSessions: "desc" },
      },
      take: 1,
    });

    let topProcedureName = "N/A";
    if (topProcedureAgg.length > 0) {
      const procedure = await prisma.procedure.findUnique({
        where: { id: topProcedureAgg[0].procedureId },
        select: { name: true },
      });
      topProcedureName = `${procedure?.name} (${topProcedureAgg[0]._sum.contractedSessions} sessões)`;
    }

    let topSellerName = "N/A";
    if (!sellerId) {
      const topSellerAgg = await prisma.treatmentPlan.groupBy({
        by: ["sellerId"],
        where: where,
        _sum: { total: true },
        orderBy: {
          _sum: { total: "desc" },
        },
        take: 1,
      });

      if (topSellerAgg.length > 0) {
        const seller = await prisma.user.findUnique({
          where: { id: topSellerAgg[0].sellerId },
          select: { fullName: true },
        });
        topSellerName = `${seller?.fullName} (${this.formatCurrency(
          topSellerAgg[0]._sum.total || 0
        )})`;
      }
    }

    const summary = {
      totalValue: totalValue.toNumber(),
      totalSales: totalSales,
      avgTicket: avgTicket.toNumber(),
      topProcedure: topProcedureName,
      topSeller: topSellerName,
    };

    const html = this.getSalesHtml(
      clinic,
      plans,
      summary,
      startDateObj,
      endDateObj,
      !!sellerId
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 10. Relatório de Formas de Pagamento
   */
  static async generatePaymentMethodsReport(
    clinicId: string,
    filters: z.infer<typeof paymentMethodsReportQuerySchema>
  ) {
    const { startDate, endDate } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de fuso horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const aggregatedData = await prisma.paymentInstallment.groupBy({
      by: ["paymentMethod"],
      where: {
        clinicId: clinicId,
        status: "PAID",
        paymentDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
      },
      _sum: {
        paidAmount: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          paidAmount: "desc",
        },
      },
    });

    let grandTotal = new Decimal(0);
    for (const group of aggregatedData) {
      grandTotal = grandTotal.add(group._sum.paidAmount || 0);
    }
    const summary = {
      totalReceived: grandTotal.toNumber(),
    };

    const html = this.getPaymentMethodsHtml(
      clinic,
      aggregatedData,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 11. Relatório de Pacientes Inativos
   */
  static async generateInactivePatientsReport(
    clinicId: string,
    filters: z.infer<typeof inactivePatientsReportQuerySchema>
  ) {
    const { days } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const today = new Date();
    const thresholdDate = subDays(today, days);

    const patients = await prisma.patient.findMany({
      where: { clinicId },
      include: {
        phones: { take: 1, orderBy: { isWhatsapp: "desc" } },
        appointments: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });

    const inactivePatients: ProcessedInactivePatient[] = [];
    for (const p of patients) {
      if (p.appointments.length > 0 && p.appointments[0].date < thresholdDate) {
        inactivePatients.push({
          name: p.name,
          phone: this.formatPhone(p.phones[0]?.number),
          lastAppointment: p.appointments[0].date,
          daysInactive: differenceInDays(today, p.appointments[0].date),
        });
      }
    }

    inactivePatients.sort((a, b) => b.daysInactive - a.daysInactive);

    const summary = {
      totalInactive: inactivePatients.length,
      daysFilter: days,
    };

    const html = this.getInactivePatientsHtml(
      clinic,
      inactivePatients,
      summary
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 12. Relatório de Extrato de Caixa (Fechamento)
   */
  static async generateCashStatementReport(
    clinicId: string,
    filters: z.infer<typeof cashStatementReportQuerySchema>
  ) {
    const { startDate, endDate, bankAccountId, type } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.FinancialTransactionWhereInput = {
      clinicId,
      date: { gte: startDateObj, lte: endDateObj },
      bankAccountId: bankAccountId || undefined,
      type: type || undefined,
    };

    const transactions = await prisma.financialTransaction.findMany({
      where,
      include: {
        paymentInstallment: {
          select: {
            dueDate: true,
            paymentMethod: true,
            treatmentPlan: {
              select: { patient: { select: { name: true } } },
            },
          },
        },
        expense: {
          select: {
            dueDate: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    });

    // Calcular Resumo
    let totalRevenue = new Decimal(0);
    let totalExpense = new Decimal(0);
    const paymentMethodTotals: Record<string, Decimal> = {};

    for (const t of transactions) {
      if (t.type === "REVENUE") {
        totalRevenue = totalRevenue.add(t.amount);
        const method = t.paymentInstallment?.paymentMethod ?? null;
        const methodName = this.formatPaymentMethod(method);
        if (!paymentMethodTotals[methodName]) {
          paymentMethodTotals[methodName] = new Decimal(0);
        }
        paymentMethodTotals[methodName] = paymentMethodTotals[methodName].add(
          t.amount
        );
      } else if (t.type === "EXPENSE") {
        totalExpense = totalExpense.add(t.amount);
      }
    }

    const paymentMethodBreakdown = Object.entries(paymentMethodTotals)
      .map(([name, total]) => ({ name, total: total.toNumber() }))
      .sort((a, b) => b.total - a.total);

    const summary = {
      totalRevenue: totalRevenue.toNumber(),
      totalExpense: totalExpense.toNumber(),
      netTotal: totalRevenue.sub(totalExpense).toNumber(),
      paymentMethodBreakdown,
    };

    const html = this.getCashStatementHtml(
      clinic,
      transactions,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  // =================================================================================
  // PARTE C: Geradores de HTML (Privados)
  // =================================================================================

  /**
   * HTML: Relatório de Atendimentos
   */
  private static getReportHtml(
    clinic: Partial<Clinic>,
    data: Record<string, AppointmentWithIncludes[]>,
    summary: { totalAppointments: number; totalValue: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let professionalsHtml = "";
    for (const professionalName in data) {
      const appointments = data[professionalName];
      let rowsHtml = "";

      for (const app of appointments) {
        const dateTime = `${format(new Date(app.date), "dd/MM/yyyy", {
          locale: ptBR,
        })} às ${app.startTime}`;
        const procedureName = app.appointmentType.name;
        const value = app.treatmentPlan
          ? this.formatCurrency(app.treatmentPlan.total)
          : "N/A";
        const status = this.getPlanPaymentStatus(app.treatmentPlan);

        rowsHtml += `
          <tr>
            <td>${app.patient.name}</td>
            <td>${dateTime}</td>
            <td>${procedureName}</td>
            <td style="text-align: right;">${value}</td>
            <td>${status}</td>
          </tr>
        `;
      }

      professionalsHtml += `
        <h3 class="professional-name">${professionalName}</h3>
        <table class="appointments-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Data e Hora</th>
              <th>Procedimento</th>
              <th style="text-align: right;">Valor do Plano</th>
              <th>Status Pagto.</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    if (Object.keys(data).length === 0) {
      professionalsHtml =
        "<p>Nenhum atendimento encontrado para o período e filtros selecionados.</p>";
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Atendimentos</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 20px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 11px; color: #555; text-transform: uppercase; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .professional-name { font-size: 14px; color: #4f46e5; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .appointments-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .appointments-table th, .appointments-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
          .appointments-table th { background-color: #f4f4f4; font-weight: bold; }
          .appointments-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Atendimentos</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total de Atendimentos</h4>
            <p>${summary.totalAppointments}</p>
          </div>
          <div class="summary-item">
            <h4>Valor Total (Planos Vinculados)</h4>
            <p>${this.formatCurrency(summary.totalValue)}</p>
          </div>
        </div>
        ${professionalsHtml}
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Valor por Profissional
   */
  private static getProfessionalValueReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    data: FlatProfessionalValueData[],
    summary: { totalValuePaid: number; totalPatients: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 20px;">
            Nenhum pagamento recebido para este profissional no período.
          </td>
        </tr>
      `;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.patientName}</td>
            <td>${item.specialtyName}</td>
            <td>${item.procedureName}</td>
            <td>${item.installmentInfo}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.procedureValue
            )}</td>
            <td>${format(item.dueDate, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${
              item.paymentDate
                ? format(item.paymentDate, "dd/MM/yyyy", { locale: ptBR })
                : "N/A"
            }</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.paidAmount
            )}</td>
            <td>${this.formatPaymentMethod(item.paymentMethod)}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Valor por Profissional</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 9px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .report-header h3 { margin: 5px 0 10px 0; font-size: 14px; color: #4f46e5; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 9px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 5px 7px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Valor por Profissional</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
          <h3>Profissional: ${professionalName}</h3>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total de Pacientes (Únicos)</h4>
            <p>${summary.totalPatients}</p>
          </div>
          <div class="summary-item">
            <h4>Total de Valor Pago</h4>
            <p>${this.formatCurrency(summary.totalValuePaid)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Especialidade</th>
              <th>Procedimento</th>
              <th>Parcela</th>
              <th>Valor (Proc.)</th>
              <th>Vencimento</th>
              <th>Pagamento</th>
              <th>Valor Pago (Parc.)</th>
              <th>Forma Pagto.</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Comissão do Vendedor
   */
  private static getCommissionReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    data: CommissionRecordWithIncludes[],
    summary: { totalPending: number; totalPaid: number; totalOverall: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px;">
            Nenhuma comissão encontrada para este vendedor no período.
          </td>
        </tr>
      `;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${format(item.calculationDate, "dd/MM/yyyy", {
              locale: ptBR,
            })}</td>
            <td>${item.treatmentPlan.patient.name}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.treatmentPlan.total
            )}</td>
            <td style="text-align: right; color: #059669; font-weight: bold;">${this.formatCurrency(
              item.calculatedAmount
            )}</td>
            <td>${this.formatCommissionStatus(item.status)}</td>
            <td>${
              item.paymentDate
                ? format(item.paymentDate, "dd/MM/yyyy", { locale: ptBR })
                : "---"
            }</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Comissão</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .report-header h3 { margin: 5px 0 10px 0; font-size: 14px; color: #4f46e5; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Comissão do Vendedor</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
          <h3>Vendedor: ${professionalName}</h3>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total Pendente</h4>
            <p style="color: #D97706;">${this.formatCurrency(
              summary.totalPending
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Pago</h4>
            <p style="color: #059669;">${this.formatCurrency(
              summary.totalPaid
            )}</p>
          </div>
           <div class="summary-item">
            <h4>Total Gerado (Pend + Pago)</h4>
            <p>${this.formatCurrency(summary.totalOverall)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Data (Cálculo)</th>
              <th>Paciente</th>
              <th>Valor da Venda (Total)</th>
              <th>Valor Comissão (Vendedor)</th>
              <th>Status</th>
              <th>Data Pagto. (Comissão)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Pacientes Atendidos
   */
  private static getAttendedPatientsReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    specialtyName: string,
    data: ProcessedPatient[],
    summary: { totalPatients: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 20px;">
            Nenhum paciente encontrado para os filtros selecionados.
          </td>
        </tr>
      `;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.name}</td>
            <td>${item.phone}</td>
            <td>${item.cpf}</td>
            <td>${item.specialty}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Pacientes Atendidos</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .report-header h3 { margin: 5px 0 10px 0; font-size: 12px; color: #555; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; width: 200px; margin: 15px auto; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 18px; font-weight: bold; color: #000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Pacientes Atendidos</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
          <h3>Profissional: ${professionalName}</h3>
          <h3>Especialidade: ${specialtyName}</h3>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total de Pacientes Únicos</h4>
            <p>${summary.totalPatients}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Telefone</th>
              <th>CPF</th>
              <th>Especialidade (Plano)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Contas a Receber
   */
  private static getAccountsReceivableHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhuma conta a receber encontrada.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr style="${
            item.status === "OVERDUE"
              ? "color: #D97706; background: #FFFBEB;"
              : ""
          }">
            <td>${format(item.dueDate, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.treatmentPlan.patient.name}</td>
            <td>${`Parcela ${item.installmentNumber}`}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.amountDue
            )}</td>
            <td>${this.formatPaymentStatus(item.status)}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Contas a Receber</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Contas a Receber</h2>
          <p>Período de Vencimento: ${formattedStartDate} até ${formattedEndDate}</p>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total a Vencer</h4>
            <p style="color: #3B82F6;">${this.formatCurrency(
              summary.totalPending
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Vencido</h4>
            <p style="color: #D97706;">${this.formatCurrency(
              summary.totalOverdue
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Geral (A Receber)</h4>
            <p>${this.formatCurrency(summary.totalOverall)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Paciente</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Contas a Pagar
   */
  private static getAccountsPayableHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhuma conta a pagar encontrada.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr style="${
            item.status === "OVERDUE"
              ? "color: #D97706; background: #FFFBEB;"
              : ""
          }">
            <td>${format(item.dueDate, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.description}</td>
            <td>${item.category?.name || "N/A"}</td>
            <td>${item.supplier?.name || "N/A"}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.amount
            )}</td>
            <td>${this.formatPaymentStatus(item.status)}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Contas a Pagar</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Contas a Pagar</h2>
          <p>Período de Vencimento: ${formattedStartDate} até ${formattedEndDate}</p>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total a Vencer</h4>
            <p style="color: #3B82F6;">${this.formatCurrency(
              summary.totalPending
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Vencido</h4>
            <p style="color: #D97706;">${this.formatCurrency(
              summary.totalOverdue
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Geral (A Pagar)</h4>
            <p>${this.formatCurrency(summary.totalOverall)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Disponibilidade de Estoque
   */
  private static getStockAvailabilityHtml(
    clinic: Partial<Clinic>,
    data: ProductWithCost[],
    summary: any
  ) {
    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum produto encontrado.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.name}</td>
            <td>${item.category.name}</td>
            <td style="text-align: right;">${item.currentStock}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.unitCost
            )}</td>
            <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
              item.totalValue
            )}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Disponibilidade de Estoque</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Disponibilidade de Estoque</h2>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Total de Itens em Estoque</h4>
          <p>${summary.totalItems}</p>
        </div>
        <div class="summary-item">
          <h4>Valor Total em Estoque (Custo)</h4>
          <p>${this.formatCurrency(summary.totalValueInStock)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Qtd. Atual</th>
            <th>Custo Unit. (Últ. Entr.)</th>
            <th>Valor Total (Custo)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Movimentação de Estoque
   */
  private static getStockMovementHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    type: StockMovementType,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });
    const title =
      type === "ENTRY"
        ? "Relatório de Entradas de Estoque"
        : "Relatório de Saídas de Estoque";

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhuma movimentação encontrada.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${format(item.date, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.product.name}</td>
            <td style="text-align: right;">${item.quantity}</td>
            <td>${item.supplier?.name || "N/A"}</td>
            <td>${item.notes || ""}</td>
            <td style="text-align: right;">${
              item.totalValue ? this.formatCurrency(item.totalValue) : "R$ 0,00"
            }</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>${title}</h2>
        <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Total de Itens (${type === "ENTRY" ? "Entrada" : "Saída"})</h4>
          <p>${summary.totalQuantity}</p>
        </div>
        <div class="summary-item">
          <h4>Valor Total (${type === "ENTRY" ? "Custo" : "N/A"})</h4>
          <p>${this.formatCurrency(summary.totalValue)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Fornecedor</th>
            <th>Observação</th>
            <th>Valor Total (Entrada)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Vendas
   */
  private static getSalesHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date,
    isFilteredBySeller: boolean
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhuma venda encontrada no período.</td></tr>`;
    } else {
      for (const item of data) {
        const proceduresList = item.procedures
          .map((p: any) => `${p.procedure.name} (${p.contractedSessions}s)`)
          .join("<br>");
        rowsHtml += `
          <tr>
            <td>${format(item.createdAt, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.patient.name}</td>
            <td>${item.seller.fullName}</td>
            <td>${proceduresList}</td>
            <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
              item.total
            )}</td>
          </tr>
        `;
      }
    }

    const topSellerHtml = isFilteredBySeller
      ? ""
      : `<div class="summary-item">
          <h4>Vendedor Destaque</h4>
          <p>${summary.topSeller}</p>
        </div>`;

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Vendas</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 13px; font-weight: bold; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; white-space: nowrap; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Vendas</h2>
        <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Valor Total Vendido</h4>
          <p style="color: #059669;">${this.formatCurrency(
            summary.totalValue
          )}</p>
        </div>
        <div class="summary-item">
          <h4>Total de Vendas</h4>
          <p>${summary.totalSales}</p>
        </div>
        <div class="summary-item">
          <h4>Ticket Médio</h4>
          <p>${this.formatCurrency(summary.avgTicket)}</p>
        </div>
        <div class="summary-item">
          <h4>Procedimento Mais Vendido</h4>
          <p>${summary.topProcedure}</p>
        </div>
        ${topSellerHtml}
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data Venda</th>
            <th>Paciente</th>
            <th>Vendedor</th>
            <th>Procedimentos (Sessões)</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Formas de Pagamento
   */
  private static getPaymentMethodsHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="3" style="text-align: center; padding: 20px;">Nenhum pagamento recebido no período.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${this.formatPaymentMethod(item.paymentMethod)}</td>
            <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
              item._sum.paidAmount || 0
            )}</td>
            <td style="text-align: right;">${item._count._all}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Formas de Pagamento</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; width: 250px; margin: 15px auto; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 16px; font-weight: bold; color: #059669; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Pagamentos por Método</h2>
        <p>Período de Pagamento: ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Valor Total Recebido no Período</h4>
          <p>${this.formatCurrency(summary.totalReceived)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Forma de Pagamento</th>
            <th>Valor Total Recebido</th>
            <th>Qtd. de Pagamentos</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Pacientes Inativos
   */
  private static getInactivePatientsHtml(
    clinic: Partial<Clinic>,
    data: ProcessedInactivePatient[],
    summary: any
  ) {
    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum paciente inativo há mais de ${summary.daysFilter} dias.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.name}</td>
            <td>${item.phone}</td>
            <td>${format(item.lastAppointment, "dd/MM/yyyy", {
              locale: ptBR,
            })}</td>
            <td style="text-align: right; font-weight: bold;">${
              item.daysInactive
            } dias</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Pacientes Inativos</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; width: 250px; margin: 15px auto; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 16px; font-weight: bold; color: #D97706; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Pacientes Inativos</h2>
        <p>Pacientes sem agendamentos nos últimos ${summary.daysFilter} dias</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Total de Pacientes Inativos</h4>
          <p>${summary.totalInactive}</p>
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>Paciente</th><th>Telefone</th><th>Último Agendamento</th><th>Dias Inativo</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Extrato de Caixa (Fechamento)
   */
  private static getCashStatementHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma transação financeira encontrada no período.</td></tr>`;
    } else {
      for (const item of data) {
        let payerOrSupplier = "N/A";
        let dueDate = "N/A";
        let paymentMethod = "N/A";

        if (item.type === "REVENUE" && item.paymentInstallment) {
          payerOrSupplier = item.paymentInstallment.treatmentPlan.patient.name;
          dueDate = format(item.paymentInstallment.dueDate, "dd/MM/yyyy", {
            locale: ptBR,
          });
          paymentMethod = this.formatPaymentMethod(
            item.paymentInstallment.paymentMethod
          );
        } else if (item.type === "EXPENSE" && item.expense) {
          payerOrSupplier = item.expense.supplier?.name || "Despesa Avulsa";
          dueDate = format(item.expense.dueDate, "dd/MM/yyyy", {
            locale: ptBR,
          });
          paymentMethod = "N/A (Saída)";
        } else if (item.type === "TRANSFER") {
          payerOrSupplier = "Transferência Interna";
          paymentMethod = "N/A (Transf.)";
        }

        const isRevenue = item.type === "REVENUE";
        const amountStyle = `font-weight: bold; text-align: right; color: ${
          isRevenue ? "#059669" : "#DC2626"
        };`;
        const amount = `${isRevenue ? "+" : "-"} ${this.formatCurrency(
          item.amount
        )}`;

        rowsHtml += `
          <tr>
            <td>${format(item.date, "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
            <td>${this.formatTransactionType(item.type)}</td>
            <td>${item.description}</td>
            <td>${payerOrSupplier}</td>
            <td>${dueDate}</td>
            <td>${paymentMethod}</td>
            <td style="${amountStyle}">${amount}</td>
          </tr>
        `;
      }
    }

    let paymentBreakdownHtml = "";
    if (
      summary.paymentMethodBreakdown &&
      summary.paymentMethodBreakdown.length > 0
    ) {
      paymentBreakdownHtml = `<div class="breakdown-list">`;
      for (const item of summary.paymentMethodBreakdown) {
        paymentBreakdownHtml += `
          <div class="breakdown-item">
            <span>${item.name}:</span>
            <span>${this.formatCurrency(item.total)}</span>
          </div>
        `;
      }
      paymentBreakdownHtml += `</div>`;
    }

    const netStyle =
      summary.netTotal >= 0 ? "color: #059669;" : "color: #DC2626;";

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Fluxo de Caixa</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { 
          border: 1px solid #eee; background: #f9f9f9; padding: 15px; 
          border-radius: 8px; margin-bottom: 20px; 
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;
        }
        .summary-item { text-align: center; }
        .summary-item h4 { 
          margin: 0 0 5px 0; font-size: 10px; color: #555; 
          text-transform: uppercase; font-weight: normal; 
        }
        .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
        .summary-item.revenue {
          grid-column: span 1;
        }
        .breakdown-list { 
          margin-top: 8px; padding-top: 8px;
          border-top: 1px solid #e5e7eb; 
        }
        .breakdown-item { 
          display: flex; justify-content: space-between; 
          font-size: 9px; color: #374151; 
          margin-bottom: 3px; text-align: left;
        }
        .breakdown-item span:last-child { font-weight: 500; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; white-space: nowrap; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Extrato de Caixa</h2>
        <p>Período de Pagamento/Transação: ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item revenue">
          <h4>Total de Entradas (Receitas)</h4>
          <p style="color: #059669;">${this.formatCurrency(
            summary.totalRevenue
          )}</p>
          ${paymentBreakdownHtml}
        </div>
        <div class="summary-item">
          <h4>Total de Saídas (Despesas)</h4>
          <p style="color: #DC2626;">${this.formatCurrency(
            summary.totalExpense
          )}</p>
        </div>
        <div class="summary-item">
          <h4>Saldo do Período (Líquido)</h4>
          <p style="${netStyle}">${this.formatCurrency(summary.netTotal)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data/Hora (Pgto)</th>
            <th>Tipo</th>
            <th>Descrição (Transação)</th>
            <th>Paciente/Fornecedor</th>
            <th>Data (Venc.)</th>
            <th>Forma Pagto.</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  // Adicione aos imports: expiredProductsReportQuerySchema

  static async generateExpiredProductsReport(
    clinicId: string,
    filters: z.infer<typeof expiredProductsReportQuerySchema>
  ) {
    const referenceDate = filters.date ? new Date(filters.date) : new Date();

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });

    // Busca movimentações de entrada que já venceram
    const expiredEntries = await prisma.stockMovement.findMany({
      where: {
        product: { clinicId },
        type: "ENTRY",
        expiryDate: { lt: referenceDate },
      },
      include: {
        product: {
          include: { category: true },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    // O HTML seguirá o padrão dos outros relatórios
    const html = this.getExpiredProductsHtml(
      clinic!,
      expiredEntries,
      referenceDate
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic!.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  private static getExpiredProductsHtml(
    clinic: any,
    entries: any[],
    refDate: Date
  ) {
    let rows = entries
      .map(
        (move) => `
    <tr>
      <td>${move.product.name}</td>
      <td>${move.product.category.name}</td>
      <td>${move.quantity}</td>
      <td style="color: red; font-weight: bold;">
        ${format(move.expiryDate, "dd/MM/yyyy")}
      </td>
      <td>${move.invoiceNumber || "N/A"}</td>
    </tr>
  `
      )
      .join("");

    return `
    <html>
      <head><style>/* copiar estilos da data-table dos outros métodos */</style></head>
      <body>
        <h2>Relatório de Produtos Vencidos</h2>
        <p>Data de Referência: ${format(refDate, "dd/MM/yyyy")}</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>Produto</th><th>Categoria</th><th>Qtd Entrou</th><th>Vencimento</th><th>NF</th>
            </tr>
          </thead>
          <tbody>${
            rows || '<tr><td colspan="5">Nenhum produto vencido.</td></tr>'
          }</tbody>
        </table>
      </body>
    </html>
  `;
  }
}

```

# specialty.service.ts

```ts
import { prisma } from "../lib/prisma";

interface SpecialtyInput {
  name: string;
  professionalIds?: string[];
}

export class SpecialtyService {
  // Lista APENAS da clínica atual
  static async list(clinicId: string) {
    return prisma.specialty.findMany({
      where: {
        clinicId: clinicId, // <--- FILTRO DE TENANCY
      },
      include: {
        _count: {
          select: { professionals: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  // Busca ID garantindo que pertence à clínica
  static async getById(id: string, clinicId: string) {
    return prisma.specialty.findFirst({
      where: {
        id,
        clinicId, // <--- SEGURANÇA
      },
      include: {
        professionals: {
          select: { id: true, fullName: true }, // Traz o nome também para exibir no form
        },
      },
    });
  }

  // Cria vinculando à clínica
  static async create(data: SpecialtyInput, clinicId: string) {
    return prisma.specialty.create({
      data: {
        name: data.name,
        clinicId: clinicId, // <--- VINCULAÇÃO
        professionals: {
          connect: data.professionalIds?.map((id) => ({ id })) || [],
        },
      },
    });
  }

  // Atualiza verificando propriedade
  static async update(id: string, data: SpecialtyInput, clinicId: string) {
    // Garante que a especialidade é desta clínica antes de editar
    await prisma.specialty.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.specialty.update({
      where: { id },
      data: {
        name: data.name,
        professionals: {
          set: data.professionalIds?.map((id) => ({ id })) || [],
        },
      },
    });
  }

  // Deleta verificando propriedade
  static async delete(id: string, clinicId: string) {
    // Garante que a especialidade é desta clínica antes de deletar
    await prisma.specialty.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.specialty.delete({ where: { id } });
  }
}

```

# specialtyTemplate.service.ts

```ts
import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createTemplateSchema,
  updateTemplateSchema,
} from "../schemas/specialtyTemplate.schema";
import { DocumentType } from "@prisma/client";

export class SpecialtyTemplateService {
  // CORREÇÃO: Receber clinicId
  static async create(
    data: z.infer<typeof createTemplateSchema>,
    clinicId: string
  ) {
    // AQUI O ERRO PROVÁVEL:
    // O prisma.specialtyTemplate.create precisa receber o 'clinicId' no 'data'.
    // Mas o Zod schema 'createTemplateSchema' NÃO tem clinicId.
    // Então precisamos injetá-lo manualmente.

    return prisma.specialtyTemplate.create({
      data: {
        ...data,
        clinicId, // <--- GARANTA QUE ISSO ESTÁ AQUI
      },
      include: {
        specialty: true,
      },
    });
  }

  static async findMany(
    specialtyId: string,
    clinicId: string,
    type?: DocumentType
  ) {
    return prisma.specialtyTemplate.findMany({
      where: {
        specialtyId,
        clinicId, // <--- GARANTA O FILTRO POR CLÍNICA
        ...(type && { type }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // CORREÇÃO: Validar propriedade
  static async findById(templateId: string, clinicId: string) {
    return prisma.specialtyTemplate.findFirstOrThrow({
      where: {
        id: templateId,
        clinicId, // <--- Garante que só acessa se for da clínica
      },
      include: {
        specialty: true,
      },
    });
  }

  // CORREÇÃO: Validar propriedade antes de atualizar
  static async update(
    templateId: string,
    data: z.infer<typeof updateTemplateSchema>,
    clinicId: string
  ) {
    // Verifica existência e propriedade
    await prisma.specialtyTemplate.findFirstOrThrow({
      where: { id: templateId, clinicId },
    });

    return prisma.specialtyTemplate.update({
      where: { id: templateId },
      data,
    });
  }

  // CORREÇÃO: Validar propriedade antes de deletar
  static async delete(templateId: string, clinicId: string) {
    // 1. Verifica se o template pertence à clínica
    await prisma.specialtyTemplate.findFirstOrThrow({
      where: { id: templateId, clinicId },
    });

    // 2. Verifica se está em uso (Regra de Negócio)
    const usageCount = await prisma.patientDocument.count({
      where: { templateId },
    });

    if (usageCount > 0) {
      // Retorna uma mensagem clara que o frontend possa exibir
      throw new Error(
        `Este template não pode ser excluído pois foi usado em ${usageCount} documento(s).`
      );
    }

    return prisma.specialtyTemplate.delete({
      where: { id: templateId },
    });
  }
}

```

# stockMovement.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateStockMovementInput } from "../schemas/stockMovement.schema";

export class StockMovementService {
  /**
   * Cria uma nova movimentação de estoque de forma transacional,
   * atualizando a quantidade do produto correspondente.
   */
  static async create(data: CreateStockMovementInput, clinicId: string) {
    const { productId, type, quantity, expenseDueDate, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Busca e valida produto (igual ao anterior)
      const product = await tx.product.findFirstOrThrow({
        where: { id: productId, clinicId },
      });

      // 2. Calcula novo estoque (igual ao anterior)
      let newStock;
      if (type === "ENTRY") {
        newStock = product.currentStock + quantity;
      } else {
        if (product.currentStock < quantity) {
          throw new Error("Estoque insuficiente para a saída.");
        }
        newStock = product.currentStock - quantity;
      }

      // 3. Atualiza produto
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      // 4. Cria movimentação
      const movement = await tx.stockMovement.create({
        data: {
          ...rest,
          productId,
          type,
          quantity,
          date: new Date(data.date),
          // Garante que se a string for vazia, salve como nulo no banco
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        },
      });

      // 5. CRIAÇÃO OBRIGATÓRIA DE DESPESA
      if (type === "ENTRY") {
        // Garantido pelo Zod que totalValue e expenseDueDate existem aqui
        if (!rest.totalValue)
          throw new Error("Valor total é necessário para entradas.");

        const description = `Compra Estoque: ${product.name} ${
          rest.invoiceNumber ? `(NF: ${rest.invoiceNumber})` : ""
        }`;

        await tx.expense.create({
          data: {
            clinicId,
            description,
            amount: rest.totalValue,
            dueDate: new Date(expenseDueDate!), // "!" pois o Zod já garantiu
            status: "PENDING",
            supplierId: rest.supplierId || null,
            notes: `Gerado automaticamente via entrada de estoque ID: ${movement.id}`,
          },
        });
      }

      return movement;
    });
  }

  /**
   * Lista o histórico de movimentações da clínica com paginação e filtros.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: { productId?: string; type?: "ENTRY" | "EXIT" }
  ) {
    const where: Prisma.StockMovementWhereInput = {
      // A segurança é garantida pela verificação do clinicId no produto relacionado.
      product: {
        clinicId: clinicId,
      },
    };

    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const skip = (page - 1) * pageSize;
    const [movements, totalCount] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          supplier: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { date: "desc" },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return { movements, totalCount };
  }

  /**
   * Deleta uma movimentação de forma transacional, revertendo o efeito no estoque.
   */
  static async delete(id: string, clinicId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Encontra a movimentação e garante que pertence à clínica (via produto)
      const movement = await tx.stockMovement.findFirstOrThrow({
        where: { id, product: { clinicId } },
        include: { product: true },
      });

      // 2. Calcula o estoque revertido
      let revertedStock;
      if (movement.type === "ENTRY") {
        revertedStock = movement.product.currentStock - movement.quantity;
        // REGRA DE NEGÓCIO: Impede a exclusão de uma entrada se isso for deixar o estoque negativo.
        if (revertedStock < 0) {
          throw new Error(
            "Não é possível excluir esta entrada, pois os itens já foram utilizados (estoque ficaria negativo)."
          );
        }
      } else {
        // 'EXIT'
        revertedStock = movement.product.currentStock + movement.quantity;
      }

      // 3. Atualiza o estoque do produto com o valor revertido
      await tx.product.update({
        where: { id: movement.productId },
        data: { currentStock: revertedStock },
      });

      // 4. Deleta a movimentação
      return tx.stockMovement.delete({ where: { id } });
    });
  }
}

```

# supplier.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "../schemas/supplier.schema";

export class SupplierService {
  static async create(data: CreateSupplierInput, clinicId: string) {
    return prisma.supplier.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.SupplierWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [suppliers, totalCount] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.supplier.count({ where }),
    ]);

    return { data: suppliers, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.supplier.findFirst({
      where: { id, clinicId },
    });
  }

  static async update(id: string, data: UpdateSupplierInput, clinicId: string) {
    await prisma.supplier.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.supplier.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.supplier.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se o fornecedor tiver movimentações de estoque.
    const movementCount = await prisma.stockMovement.count({
      where: { supplierId: id },
    });

    if (movementCount > 0) {
      throw new Error("SUPPLIER_IN_USE");
    }

    return prisma.supplier.delete({ where: { id } });
  }
}

```

# treatmentPlan.service.ts

```ts
// src/services/treatmentPlan.service.ts
import { CommissionTriggerEvent, PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CreateTreatmentPlanInput } from "../schemas/treatmentPlan.schema";
import { CommissionRecordService } from "./commissionRecord.service";

export class TreatmentPlanService {
  /**
   * Cria um novo Plano de Tratamento e suas parcelas associadas.
   */
  static async create(clinicId: string, data: CreateTreatmentPlanInput) {
    // <-- Usa o tipo importado
    // Separa os dados do plano, procedimentos e termos de pagamento
    const { procedures, paymentTerms, ...planData } = data;

    if (!procedures || procedures.length === 0) {
      throw new Error("Pelo menos um procedimento é necessário.");
    }
    if (!paymentTerms || paymentTerms.numberOfInstallments < 1) {
      throw new Error("Termos de pagamento inválidos.");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Cria o Plano de Tratamento
      const newPlan = await tx.treatmentPlan.create({
        data: {
          ...planData,
          clinicId,
          procedures: {
            create: procedures.map((proc) => ({
              procedureId: proc.procedureId,
              contractedSessions: proc.contractedSessions, // Já são números pelo Zod coerce
              unitPrice: proc.unitPrice, // Já é número pelo Zod coerce
              followUps: proc.followUps,
            })),
          },
        },
      });

      // --- LÓGICA COMPLETA DE CRIAÇÃO DE PARCELAS ---
      const totalAmount = newPlan.total;
      const numberOfInstallments = paymentTerms.numberOfInstallments;
      const installmentAmount = Number.parseFloat(
        (Number(totalAmount) / numberOfInstallments).toFixed(2)
      );

      // Calcula o valor da última parcela para ajustar arredondamentos
      const lastInstallmentAmount =
        Number(totalAmount) - installmentAmount * (numberOfInstallments - 1);

      const installmentsData = [];
      let currentDueDate = paymentTerms.firstDueDate
        ? new Date(paymentTerms.firstDueDate)
        : new Date();
      if (!paymentTerms.firstDueDate) {
        currentDueDate.setDate(currentDueDate.getDate() + 30); // Padrão D+30 se não informado
      }

      for (let i = 1; i <= numberOfInstallments; i++) {
        installmentsData.push({
          treatmentPlanId: newPlan.id,
          clinicId: clinicId,
          installmentNumber: i,
          dueDate: new Date(currentDueDate), // Cria uma nova instância da data
          amountDue:
            i === numberOfInstallments
              ? lastInstallmentAmount
              : installmentAmount, // Usa valor ajustado na última
          status: PaymentStatus.PENDING,
        });

        // Adiciona 1 mês para a próxima parcela (cuidado com virada de ano/mês)
        currentDueDate.setMonth(currentDueDate.getMonth() + 1);
      }

      // Cria todas as parcelas de uma vez
      await tx.paymentInstallment.createMany({
        data: installmentsData,
      });

      const sellerWithPlan = await tx.user.findUnique({
        where: { id: newPlan.sellerId },
        include: { CommissionPlan: true },
      });

      if (
        sellerWithPlan?.CommissionPlan?.triggerEvent ===
        CommissionTriggerEvent.ON_SALE
      ) {
        console.log(`Disparando comissão ON_SALE para plano ${newPlan.id}`);
        try {
          await CommissionRecordService.calculateAndRecordCommissionForPlan(
            tx,
            newPlan.id
          );
        } catch (commissionError: any) {
          console.error(
            `Erro ao calcular/registrar comissão ON_SALE para plano ${newPlan.id}:`,
            commissionError.message
          );
          // Decida se o erro na comissão deve falhar a criação do plano
          // throw commissionError;
        }
      }

      // Retorna o plano completo com as parcelas
      return tx.treatmentPlan.findUnique({
        where: { id: newPlan.id },
        include: {
          procedures: { include: { procedure: true } },
          patient: true,
          seller: true,
          paymentInstallments: { orderBy: { installmentNumber: "asc" } }, // Ordena as parcelas
        },
      });
    });
  }

  static async list(clinicId: string) {
    // A listagem pode incluir a contagem de parcelas totais e pagas, se útil
    return prisma.treatmentPlan.findMany({
      where: { clinicId },
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        _count: {
          select: {
            procedures: true,
            paymentInstallments: true, // Total de parcelas
          },
        },
        paymentInstallments: {
          // Para calcular quantas foram pagas
          where: { status: PaymentStatus.PAID },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getById(id: string, clinicId: string) {
    return prisma.treatmentPlan.findFirst({
      where: { id, clinicId },
      include: {
        patient: true,
        seller: true,
        procedures: {
          include: {
            procedure: true,
          },
        },
        // Inclui parcelas ordenadas ao buscar detalhes
        paymentInstallments: {
          orderBy: { installmentNumber: "asc" },
        },
      },
    });
  }
}

```

# user.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { supabase } from "../lib/supabase";
import { MultipartFile } from "@fastify/multipart";

const SIGNATURES_BUCKET = "signatures";

export class UserService {
  static async create(clinicId: string, data: any) {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        account: {
          select: {
            subscription: {
              select: { currentMaxUsers: true, status: true },
            },
          },
        },
      },
    });

    const sub = clinic.account?.subscription;

    if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
      throw new Error("Sua assinatura não está ativa. Verifique o pagamento.");
    }

    const currentUsers = await prisma.user.count({
      where: { clinicId: clinicId },
    });

    if (currentUsers >= sub.currentMaxUsers) {
      throw new Error(
        `Limite de usuários atingido (${sub.currentMaxUsers}). Faça um upgrade ou compre usuários adicionais.`
      );
    }

    // Extrai signatureImagePath junto com os outros dados
    const { specialtyIds, password, signatureImagePath, ...userData } = data;
    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        clinicId,
        // Salva o caminho da assinatura
        signatureImagePath: signatureImagePath || null,
        specialties: {
          connect: specialtyIds?.map((id: string) => ({ id })) || [],
        },
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    document?: string
  ) {
    // 1. Primeiro, descobrimos quem é o Dono da Conta dessa Clínica
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });

    const ownerId = clinic?.account?.ownerId;

    const where: Prisma.UserWhereInput = {
      AND: [
        {
          OR: [
            { clinicId: clinicId },
            ...(ownerId ? [{ id: ownerId, isProfessional: true }] : []),
          ],
        },
      ],
    };

    if (name) {
      (where.AND as Prisma.UserWhereInput[]).push({
        fullName: { contains: name, mode: "insensitive" },
      });
    }

    if (document) {
      (where.AND as Prisma.UserWhereInput[]).push({
        OR: [
          { cpf: { contains: document } },
          { email: { contains: document } },
        ],
      });
    }

    const skip = (page - 1) * pageSize;

    const [users, totalCount] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: {
          specialties: true,
          role: true,
          CommissionPlan: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { fullName: "asc" },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map(({ CommissionPlan, ...user }) => ({
      ...user,
      commissionPlan: CommissionPlan,
    }));

    return { users: formattedUsers, totalCount };
  }

  static async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        specialties: true,
        CommissionPlan: true,
        ProfessionalCouncil: true,
      },
    });

    if (user) {
      const { CommissionPlan, ProfessionalCouncil, ...rest } = user;
      return {
        ...rest,
        commissionPlan: CommissionPlan,
        professionalCouncil: ProfessionalCouncil,
      };
    }
    return null;
  }

  static async update(id: string, data: any) {
    // Extrai signatureImagePath aqui também
    const { specialtyIds, signatureImagePath, ...userData } = data;
    await prisma.user.findFirstOrThrow({ where: { id } });

    if (userData.commissionPlanId === "") userData.commissionPlanId = null;
    if (userData.professionalCouncilId === "")
      userData.professionalCouncilId = null;

    return prisma.user.update({
      where: { id },
      data: {
        ...userData,
        // Atualiza a assinatura se ela vier no payload
        signatureImagePath: signatureImagePath,
        specialties:
          specialtyIds === undefined
            ? undefined
            : {
                set: specialtyIds?.map((id: string) => ({ id })) || [],
              },
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.user.findFirstOrThrow({
      where: {
        id,
        clinicId,
      },
    });

    return prisma.user.delete({ where: { id } });
  }

  static async uploadSignature(file: MultipartFile, clinicId: string) {
    const fileExtension = file.filename.split(".").pop();
    const fileName = `${randomUUID()}.${fileExtension}`;
    // Organiza por clínica para não virar bagunça
    const filePath = `${clinicId}/professionals/${fileName}`;

    // Converte o stream para buffer para enviar ao Supabase
    const buffer = await file.toBuffer();

    const { data, error } = await supabase.storage
      .from(SIGNATURES_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error("Erro upload assinatura:", error);
      throw new Error("Falha ao salvar assinatura no storage.");
    }

    return data.path; // Retorna o caminho para o frontend salvar no formulário
  }
}

```

