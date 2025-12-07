import { prisma } from "../lib/prisma";
import { CreateAppointmentInput } from "../schemas/appointment.schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Custom Error class for better error handling
class SessionLimitError extends Error {
  scheduledDates: string[];
  constructor(message: string, scheduledDates: string[]) {
    super(message);
    this.name = "SessionLimitError";
    this.scheduledDates = scheduledDates;
  }
}

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

      // 2. LÓGICA DE CORREÇÃO (Recontagem Segura)
      // Se este agendamento está vinculado a um procedimento específico de um plano...
      if (updatedAppointment.treatmentPlanProcedureId) {
        // ...contamos quantos agendamentos COMPLETED existem para esse procedimento no banco
        const realCompletedCount = await tx.appointment.count({
          where: {
            treatmentPlanProcedureId:
              updatedAppointment.treatmentPlanProcedureId,
            status: "COMPLETED",
          },
        });

        // ...e atualizamos o contador com o valor REAL exato (nunca será negativo)
        await tx.treatmentPlanProcedure.update({
          where: { id: updatedAppointment.treatmentPlanProcedureId },
          data: { completedSessions: realCompletedCount },
        });
      }

      return updatedAppointment;
    });
  }

  static async create(clinicId: string, data: CreateAppointmentInput) {
    // --- LÓGICA DE VALIDAÇÃO CORRIGIDA ---

    // Se estivermos vinculando a um procedimento específico do plano
    if (data.treatmentPlanProcedureId) {
      const planItem = await prisma.treatmentPlanProcedure.findUnique({
        where: { id: data.treatmentPlanProcedureId },
      });

      if (planItem) {
        // Conta agendamentos DESTE procedimento específico
        const existingAppointments = await prisma.appointment.findMany({
          where: {
            treatmentPlanProcedureId: data.treatmentPlanProcedureId, // Busca pelo item específico
            NOT: {
              status: "CANCELED",
            },
          },
          select: { date: true, startTime: true },
        });

        // Verifica o limite
        if (existingAppointments.length >= planItem.contractedSessions) {
          const scheduledDates = existingAppointments.map((apt) =>
            format(new Date(apt.date), "dd/MM/yyyy", { locale: ptBR })
          );

          throw new SessionLimitError(
            `Todas as ${planItem.contractedSessions} sessões contratadas para este procedimento já foram agendadas.`,
            scheduledDates
          );
        }
      }
    }
    // --- FIM DA VALIDAÇÃO ---

    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        professionalId: data.professionalId,
        appointmentTypeId: data.appointmentTypeId,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
        date: new Date(data.date),
        treatmentPlanId: data.treatmentPlanId,
        // Salva o vínculo específico
        treatmentPlanProcedureId: data.treatmentPlanProcedureId,
      },
    });

    return appointment;
  }

  static async listPatients(clinicId: string) {
    return prisma.patient.findMany({
      where: { clinicId },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  static async listAppointmentTypes() {
    return prisma.appointmentType.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
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
          include: {
            procedure: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
