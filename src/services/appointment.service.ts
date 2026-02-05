import { prisma } from "../lib/prisma";
import { CreateAppointmentInput } from "../schemas/appointment.schema";
import { format, getDay, startOfDay, endOfDay, addHours } from "date-fns";
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
    clinicId: string, // ADICIONADO
    appointmentId: string,
    status:
      | "SCHEDULED"
      | "CONFIRMED"
      | "CANCELED"
      | "COMPLETED"
      | "IN_PROGRESS"
      | "WAITING"
  ) {
    // 1. Verificação de Segurança
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patient: { clinicId: clinicId }, // Garante que pertence à clínica
      },
    });

    if (!appointment) {
      throw new Error("Agendamento não encontrado ou acesso negado.");
    }

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
        clinics: { some: { id: clinicId } }, // Garante que o profissional atua nesta clínica
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
        `O profissional ${professional.fullName} não atende neste dia da semana (${diasTraduzidos[dayOfWeekString]}).`
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
        // IMPORTANTE: Filtrar conflitos APENAS dentro da clínica ou GLOBAL?
        // Se o profissional trabalha em 2 clínicas, ele não pode estar em 2 lugares.
        // Geralmente, conflito de horário é GLOBAL (sem clinicId no where).
        // MANTIVE GLOBAL AQUI para evitar double-booking do médico.
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

    // 5. LIMITE DE SESSÕES DO PLANO
    if (data.treatmentPlanProcedureId) {
      // Segurança: verificar se o item do plano pertence a um plano desta clínica
      const planItem = await prisma.treatmentPlanProcedure.findFirst({
        where: {
          id: data.treatmentPlanProcedureId,
          treatmentPlan: { clinicId: clinicId },
        },
      });

      if (planItem) {
        const existingPlanAppointments = await prisma.appointment.findMany({
          where: {
            treatmentPlanProcedureId: data.treatmentPlanProcedureId,
            NOT: { status: "CANCELED" },
          },
          select: { date: true },
        });

        if (existingPlanAppointments.length >= planItem.contractedSessions) {
          const scheduledDates = existingPlanAppointments.map((apt) =>
            format(new Date(apt.date), "dd/MM/yyyy", { locale: ptBR })
          );

          throw new SessionLimitError(
            `Todas as ${planItem.contractedSessions} sessões contratadas já foram agendadas.`,
            scheduledDates
          );
        }
      } else if (data.treatmentPlanProcedureId) {
        // Se mandou ID mas não achou na clínica
        throw new Error("Item do plano de tratamento não encontrado.");
      }
    }

    // 6. CRIAR
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
        patient: { clinicId: clinicId }, // SEGURANÇA
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

    // Se mudou o profissional, verificar se o novo pertence à clínica
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

    // Tratamento de data no update também
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
