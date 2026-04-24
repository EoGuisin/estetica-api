// src/services/AppointmentService.ts
import { prisma } from "../lib/prisma";
import { CreateAppointmentInput } from "../schemas/appointment.schema";
import { format, getDay } from "date-fns";
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

class SchedulingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulingError";
  }
}

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
    clinicId: string,
    appointmentId: string,
    status:
      | "SCHEDULED"
      | "CONFIRMED"
      | "CANCELED"
      | "COMPLETED"
      | "IN_PROGRESS"
      | "WAITING",
    usedProducts?: { productId: string; quantity: number }[]
  ) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, patient: { clinicId: clinicId } },
    });

    if (!appointment)
      throw new Error("Agendamento não encontrado ou acesso negado.");

    return prisma.$transaction(async (tx) => {
      // 1. Atualiza o status do agendamento e traz os procedimentos vinculados
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status },
        include: { treatmentPlanProcedures: true }, // Relação N:N
      });

      // 2. Atualiza a contagem de sessões concluídas para CADA procedimento vinculado
      if (updatedAppointment.treatmentPlanProcedures.length > 0) {
        for (const proc of updatedAppointment.treatmentPlanProcedures) {
          // Conta exatamente quantos agendamentos concluídos possuem ESTE procedimento
          const realCompletedCount = await tx.appointment.count({
            where: {
              treatmentPlanProcedures: { some: { id: proc.id } },
              status: "COMPLETED",
            },
          });

          await tx.treatmentPlanProcedure.update({
            where: { id: proc.id },
            data: { completedSessions: realCompletedCount },
          });
        }
      }

      // 3. Lógica de baixa de estoque
      if (status === "COMPLETED" && usedProducts && usedProducts.length > 0) {
        for (const item of usedProducts) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, clinicId },
          });

          if (!product)
            throw new Error(`Produto ${item.productId} não encontrado.`);
          if (product.currentStock < item.quantity) {
            throw new Error(
              `Estoque insuficiente para o produto: ${product.name}`
            );
          }

          // Dá baixa no estoque
          await tx.product.update({
            where: { id: product.id },
            data: { currentStock: product.currentStock - item.quantity },
          });

          // Registra a movimentação de SAÍDA vinculada ao atendimento
          await tx.stockMovement.create({
            data: {
              type: "EXIT",
              quantity: item.quantity,
              date: new Date(),
              productId: product.id,
              appointmentId: appointmentId,
              notes: "Uso de material em atendimento/sessão.",
            },
          });
        }
      }

      return updatedAppointment;
    });
  }

  static async create(clinicId: string, data: CreateAppointmentInput) {
    // 0. BUSCAR CONFIGURAÇÃO DA CLÍNICA
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        allowParallelAppointments: true,
        parallelAppointmentsLimit: true,
        openingHour: true,
        closingHour: true,
      },
    });

    // 0.1 SEGURANÇA: Verificar se o paciente pertence a esta clínica
    const patientCheck = await prisma.patient.findFirst({
      where: { id: data.patientId, clinicId: clinicId },
    });
    if (!patientCheck) {
      throw new Error("Paciente não encontrado nesta clínica.");
    }

    // 1. DADOS DO PROFISSIONAL + SEGURANÇA (Verifica vínculo)
    const professional = await prisma.user.findFirst({
      where: {
        id: data.professionalId,
        clinics: { some: { id: clinicId } },
      },
      select: {
        fullName: true,
        workingDays: true,
        scheduleStartHour: true,
        scheduleEndHour: true,
      },
    });

    if (!professional) {
      throw new Error("Profissional não encontrado nesta clínica.");
    }

    if (
      data.startTime < clinic.openingHour ||
      data.endTime > clinic.closingHour
    ) {
      throw new SchedulingError(
        `O agendamento deve estar dentro do horário de funcionamento da clínica (${clinic.openingHour} às ${clinic.closingHour}).`
      );
    }

    // --- CORREÇÃO DE DATA ---
    const appointmentDate = new Date(data.date + "T00:00:00.000Z");
    const dateForCheck = new Date(data.date + "T12:00:00");

    // 2. VALIDAÇÃO DE DIA DE FUNCIONAMENTO
    const dayOfWeekNumber = getDay(dateForCheck);
    const dayOfWeekString = DAY_MAP[dayOfWeekNumber];

    if (!professional.workingDays.includes(dayOfWeekString)) {
      const diasTraduzidos: any = {
        SUNDAY: "Domingo",
        MONDAY: "Segunda",
        TUESDAY: "Terça",
        WEDNESDAY: "Quarta",
        THURSDAY: "Quinta",
        FRIDAY: "Sexta",
        SATURDAY: "Sábado",
      };

      throw new SchedulingError(
        `O profissional ${professional.fullName} não atende neste dia da semana (${diasTraduzidos[dayOfWeekString]}). \n\n Vá até Equipes e Usuários e edite o horário de atendimento do profissional selecionado.`
      );
    }

    // 3. VALIDAÇÃO DE HORÁRIO DE EXPEDIENTE
    if (professional.scheduleStartHour && professional.scheduleEndHour) {
      if (
        data.startTime < professional.scheduleStartHour ||
        data.endTime > professional.scheduleEndHour
      ) {
        throw new SchedulingError(
          `Horário fora do expediente do profissional (${professional.scheduleStartHour} às ${professional.scheduleEndHour}).`
        );
      }
    }

    // 4. VALIDAÇÃO DE CONFLITO
    const startOfDayQuery = new Date(data.date + "T00:00:00.000Z");
    const endOfDayQuery = new Date(data.date + "T23:59:59.999Z");

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        professionalId: data.professionalId,
        date: {
          gte: startOfDayQuery,
          lte: endOfDayQuery,
        },
        status: { not: "CANCELED" },
      },
      select: { startTime: true, endTime: true },
    });

    const conflictingCount = existingAppointments.filter((existing) => {
      return (
        data.startTime < existing.endTime && data.endTime > existing.startTime
      );
    }).length;

    if (clinic.allowParallelAppointments) {
      if (conflictingCount >= clinic.parallelAppointmentsLimit) {
        throw new SchedulingError(
          `O limite de agendamentos simultâneos (${clinic.parallelAppointmentsLimit}) para este horário foi atingido.`
        );
      }
    } else {
      if (conflictingCount > 0) {
        throw new SchedulingError(
          "Já existe um agendamento para este profissional neste horário."
        );
      }
    }

    // 5. VALIDAÇÃO DE OBRIGATORIEDADE E LIMITE DE SESSÕES PARA MÚLTIPLOS PROCEDIMENTOS
    if (
      data.category === "SESSION" &&
      (!data.procedureIds || data.procedureIds.length === 0)
    ) {
      throw new SchedulingError(
        "Para agendamentos do tipo SESSÃO, é obrigatório vincular pelo menos um procedimento."
      );
    }

    if (data.procedureIds && data.procedureIds.length > 0) {
      for (const procId of data.procedureIds) {
        const planItem = await prisma.treatmentPlanProcedure.findFirst({
          where: { id: procId, treatmentPlan: { clinicId } },
          include: { procedure: true },
        });

        if (!planItem) throw new Error("Procedimento do plano não encontrado.");

        const existingApts = await prisma.appointment.findMany({
          where: {
            treatmentPlanProcedures: { some: { id: procId } },
            NOT: { status: "CANCELED" },
          },
          select: { date: true },
        });

        if (existingApts.length >= planItem.contractedSessions) {
          const scheduledDates = existingApts.map((apt) =>
            format(new Date(apt.date), "dd/MM/yyyy", { locale: ptBR })
          );

          throw new SessionLimitError(
            `O procedimento '${planItem.procedure.name}' já teve todas as ${planItem.contractedSessions} sessões agendadas.`,
            scheduledDates
          );
        }
      }
    }

    // 6. CRIAR
    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        professionalId: data.professionalId,
        appointmentTypeId: data.appointmentTypeId,
        category: data.category,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
        date: appointmentDate,
        // Conecta os procedimentos passados no array
        treatmentPlanProcedures: data.procedureIds?.length
          ? { connect: data.procedureIds.map((id) => ({ id })) }
          : undefined,
      },
    });

    return appointment;
  }

  static async listPatients(clinicId: string) {
    return prisma.patient.findMany({
      where: { clinicId },
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

  static async update(
    clinicId: string,
    appointmentId: string,
    data: Partial<CreateAppointmentInput>
  ) {
    // 1. Busca com SEGURANÇA
    const existing = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patient: { clinicId: clinicId },
      },
      include: { professional: true },
    });

    if (!existing) {
      throw new Error("Agendamento não encontrado ou acesso negado.");
    }

    if (
      ["CANCELED", "COMPLETED", "CONFIRMED", "WAITING"].includes(
        existing.status
      )
    ) {
      throw new SchedulingError(
        `Não é possível editar agendamentos com status: ${existing.status}`
      );
    }

    const targetProfessionalId = data.professionalId || existing.professionalId;

    if (
      data.professionalId &&
      data.professionalId !== existing.professionalId
    ) {
      const profCheck = await prisma.user.findFirst({
        where: {
          id: data.professionalId,
          clinics: { some: { id: clinicId } },
        },
      });
      if (!profCheck) {
        throw new Error("O novo profissional não pertence a esta clínica.");
      }
    }

    let targetDate = existing.date;
    if (data.date) {
      targetDate = new Date(data.date + "T00:00:00.000Z");
    }

    const dateStr = data.date || existing.date.toISOString().split("T")[0];
    const dateForCheck = new Date(dateStr + "T12:00:00");

    const targetStartTime = data.startTime || existing.startTime;
    const targetEndTime = data.endTime || existing.endTime;

    const isRescheduling =
      targetProfessionalId !== existing.professionalId ||
      data.date ||
      data.startTime ||
      data.endTime;

    if (isRescheduling) {
      const clinic = await prisma.clinic.findUniqueOrThrow({
        where: { id: clinicId },
        select: {
          allowParallelAppointments: true,
          parallelAppointmentsLimit: true,
          openingHour: true,
          closingHour: true,
        },
      });

      const checkStart = data.startTime || existing.startTime;
      const checkEnd = data.endTime || existing.endTime;

      if (checkStart < clinic.openingHour || checkEnd > clinic.closingHour) {
        throw new SchedulingError(
          `O agendamento deve estar dentro do horário de funcionamento da clínica (${clinic.openingHour} às ${clinic.closingHour}).`
        );
      }

      const professional = await prisma.user.findUniqueOrThrow({
        where: { id: targetProfessionalId },
        select: {
          fullName: true,
          workingDays: true,
          scheduleStartHour: true,
          scheduleEndHour: true,
        },
      });

      const dayOfWeekNumber = getDay(dateForCheck);
      const dayOfWeekString = DAY_MAP[dayOfWeekNumber];

      if (!professional.workingDays.includes(dayOfWeekString)) {
        const diasTraduzidos: any = {
          SUNDAY: "Domingo",
          MONDAY: "Segunda",
          TUESDAY: "Terça",
          WEDNESDAY: "Quarta",
          THURSDAY: "Quinta",
          FRIDAY: "Sexta",
          SATURDAY: "Sábado",
        };
        throw new SchedulingError(
          `O profissional ${professional.fullName} não atende neste dia (${
            diasTraduzidos[dayOfWeekString] || dayOfWeekString
          }).`
        );
      }

      if (professional.scheduleStartHour && professional.scheduleEndHour) {
        if (
          targetStartTime < professional.scheduleStartHour ||
          targetEndTime > professional.scheduleEndHour
        ) {
          throw new SchedulingError(
            `Horário fora do expediente de ${professional.fullName} (${professional.scheduleStartHour} - ${professional.scheduleEndHour}).`
          );
        }
      }

      const startOfDayQuery = new Date(dateStr + "T00:00:00.000Z");
      const endOfDayQuery = new Date(dateStr + "T23:59:59.999Z");

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          professionalId: targetProfessionalId,
          date: {
            gte: startOfDayQuery,
            lte: endOfDayQuery,
          },
          id: { not: appointmentId },
          status: { not: "CANCELED" },
        },
        select: { startTime: true, endTime: true },
      });

      const conflictingCount = existingAppointments.filter((existing) => {
        return (
          targetStartTime < existing.endTime &&
          targetEndTime > existing.startTime
        );
      }).length;

      if (clinic.allowParallelAppointments) {
        if (conflictingCount >= clinic.parallelAppointmentsLimit) {
          throw new SchedulingError(
            `Este profissional já atingiu o limite de ${clinic.parallelAppointmentsLimit} atendimentos simultâneos (encaixes) neste horário.`
          );
        }
      } else {
        if (conflictingCount > 0) {
          throw new SchedulingError(
            "Já existe um agendamento para este profissional neste horário e a clínica não permite encaixes."
          );
        }
      }
    }

    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        professionalId: targetProfessionalId,
        date: targetDate,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
      },
    });
  }
}
