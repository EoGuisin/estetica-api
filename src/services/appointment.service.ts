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
      include: { professional: true }, // Incluir dados do profissional atual
    });

    // 1. Bloqueio de segurança (Status imutáveis)
    if (
      ["CANCELED", "COMPLETED", "CONFIRMED", "WAITING"].includes(
        existing.status
      )
    ) {
      throw new SchedulingError(
        `Não é possível editar agendamentos com status: ${existing.status}`
      );
    }

    // 2. Determinar quais dados usar (Novos ou existentes)
    const targetProfessionalId = data.professionalId || existing.professionalId;
    const targetDate = data.date ? new Date(data.date) : existing.date;

    // Pequeno ajuste para garantir a leitura correta do dia da semana (timezone fix)
    const dateForCheck = new Date(
      targetDate.toISOString().split("T")[0] + "T12:00:00"
    );

    const targetStartTime = data.startTime || existing.startTime;
    const targetEndTime = data.endTime || existing.endTime;

    // Se mudou o profissional OU a data/hora, precisamos revalidar a agenda
    const isRescheduling =
      targetProfessionalId !== existing.professionalId ||
      data.date ||
      data.startTime ||
      data.endTime;

    if (isRescheduling) {
      // A. Buscar dados do Profissional Alvo (pode ser o novo ou o mesmo)
      const professional = await prisma.user.findUniqueOrThrow({
        where: { id: targetProfessionalId },
        select: {
          fullName: true,
          workingDays: true,
          scheduleStartHour: true,
          scheduleEndHour: true,
        },
      });

      // B. Validação de Dia de Funcionamento
      const dayOfWeekNumber = getDay(dateForCheck);
      const dayOfWeekString = DAY_MAP[dayOfWeekNumber];

      if (!professional.workingDays.includes(dayOfWeekString)) {
        // ... lógica de tradução dos dias ...
        const diasTraduzidos: Record<string, string> = {
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

      // C. Validação de Horário de Expediente
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

      // D. Validação de Conflito (Overlap)
      const hasConflict = await prisma.appointment.findFirst({
        where: {
          professionalId: targetProfessionalId, // Checa na agenda do profissional ALVO
          date: targetDate,
          id: { not: appointmentId }, // Ignora o próprio agendamento sendo editado
          status: { not: "CANCELED" },
          AND: [
            { startTime: { lt: targetEndTime } },
            { endTime: { gt: targetStartTime } },
          ],
        },
      });

      if (hasConflict) {
        throw new SchedulingError(
          `Conflito de horário na agenda de ${professional.fullName}.`
        );
      }
    }

    // Atualiza
    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        professionalId: targetProfessionalId, // Atualiza o ID do profissional
        date: data.date ? new Date(data.date) : undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
      },
    });
  }
}
