import { prisma } from "../lib/prisma";
import { CreateAppointmentInput } from "../schemas/appointment.schema";
import { format, getDay, startOfDay, endOfDay, addHours } from "date-fns"; // Adicionei imports do date-fns
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
    // 0. BUSCAR CONFIGURAÇÃO DA CLÍNICA
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        allowParallelAppointments: true,
        parallelAppointmentsLimit: true,
      },
    });

    // 1. DADOS DO PROFISSIONAL
    const professional = await prisma.user.findUniqueOrThrow({
      where: { id: data.professionalId },
      select: {
        fullName: true,
        workingDays: true,
        scheduleStartHour: true,
        scheduleEndHour: true,
      },
    });

    // --- CORREÇÃO DE DATA ---
    // Garante que a data salva seja sempre "limpa" (meia-noite UTC ou local consistente)
    // Se data.date vier "2026-02-04", forçamos o ISO para garantir consistência
    const appointmentDate = new Date(data.date + "T00:00:00.000Z");

    // Para verificação de dia da semana, usamos um horário seguro (meio-dia) para evitar pular o dia por fuso
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

    // 4. VALIDAÇÃO DE CONFLITO (CORRIGIDA COM RANGE DE DATA)
    // Aqui usamos gte (maior ou igual) e lte (menor ou igual) para pegar TUDO daquele dia
    // Isso evita bugs de fuso horário onde a data exata não bate
    const startOfDayQuery = new Date(data.date + "T00:00:00.000Z");
    const endOfDayQuery = new Date(data.date + "T23:59:59.999Z");

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        professionalId: data.professionalId,
        // CORREÇÃO AQUI: Range de data
        date: {
          gte: startOfDayQuery,
          lte: endOfDayQuery,
        },
        status: { not: "CANCELED" },
      },
      select: { startTime: true, endTime: true },
    });

    // Conta conflitos reais de horário
    const conflictingCount = existingAppointments.filter((existing) => {
      return (
        data.startTime < existing.endTime && data.endTime > existing.startTime
      );
    }).length;

    // Aplica regra da clínica
    if (clinic.allowParallelAppointments) {
      // Exemplo: Limite 2. Se já tenho 2, conflictingCount = 2.
      // 2 >= 2 -> ERRO. (Correto, não pode criar o 3º)
      if (conflictingCount >= clinic.parallelAppointmentsLimit) {
        throw new SchedulingError(
          `O limite de agendamentos simultâneos (${clinic.parallelAppointmentsLimit}) para este horário foi atingido.`
        );
      }
    } else {
      // Padrão: Se tiver qualquer um (1), já bloqueia o 2º.
      if (conflictingCount > 0) {
        throw new SchedulingError(
          "Já existe um agendamento para este profissional neste horário."
        );
      }
    }

    // 5. LIMITE DE SESSÕES DO PLANO
    if (data.treatmentPlanProcedureId) {
      const planItem = await prisma.treatmentPlanProcedure.findUnique({
        where: { id: data.treatmentPlanProcedureId },
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
        date: appointmentDate, // Salva com a data normalizada
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
    const existing = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      include: { professional: true },
    });

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

    // Tratamento de data no update também
    let targetDate = existing.date;
    if (data.date) {
      targetDate = new Date(data.date + "T00:00:00.000Z");
    }

    // Data para checagem de dia da semana
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
        },
      });

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

      // CORREÇÃO NO UPDATE TAMBÉM (Range de Data)
      const startOfDayQuery = new Date(dateStr + "T00:00:00.000Z");
      const endOfDayQuery = new Date(dateStr + "T23:59:59.999Z");

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          professionalId: targetProfessionalId,
          date: {
            gte: startOfDayQuery,
            lte: endOfDayQuery,
          },
          id: { not: appointmentId }, // Ignora ele mesmo
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
