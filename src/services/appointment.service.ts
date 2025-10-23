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
    status: "SCHEDULED" | "CONFIRMED" | "CANCELED" | "COMPLETED" | "IN_PROGRESS"
  ) {
    // Use a transaction to ensure both appointment and session count are updated together
    return prisma.$transaction(async (tx) => {
      // 1. Get the current state of the appointment before updating
      const currentAppointment = await tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        select: { status: true, treatmentPlanId: true },
      });

      const oldStatus = currentAppointment.status;
      const { treatmentPlanId } = currentAppointment;

      // 2. Update the appointment status
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status },
      });

      // 3. If it's linked to a treatment plan, update the completed session count
      if (treatmentPlanId) {
        // Find the specific procedure within the plan this appointment is for
        // NOTE: This assumes the plan has one main procedure. For multi-procedure plans,
        // you might need to link appointments to a `treatmentPlanProcedureId` directly.
        const planProcedure = await tx.treatmentPlanProcedure.findFirst({
          where: { treatmentPlanId: treatmentPlanId },
        });

        if (planProcedure) {
          // Increment count if moving TO completed
          if (status === "COMPLETED" && oldStatus !== "COMPLETED") {
            await tx.treatmentPlanProcedure.update({
              where: { id: planProcedure.id },
              data: { completedSessions: { increment: 1 } },
            });
          }
          // Decrement count if moving FROM completed
          else if (status !== "COMPLETED" && oldStatus === "COMPLETED") {
            await tx.treatmentPlanProcedure.update({
              where: { id: planProcedure.id },
              data: { completedSessions: { decrement: 1 } },
            });
          }
        }
      }

      return updatedAppointment;
    });
  }

  static async create(clinicId: string, data: CreateAppointmentInput) {
    // --- NEW VALIDATION LOGIC STARTS HERE ---
    if (data.treatmentPlanId) {
      // Find the procedure within the plan to get session limits
      const planProcedure = await prisma.treatmentPlanProcedure.findFirst({
        where: { treatmentPlanId: data.treatmentPlanId },
      });

      if (planProcedure) {
        // Count existing appointments for this plan that are NOT canceled
        const existingAppointments = await prisma.appointment.findMany({
          where: {
            treatmentPlanId: data.treatmentPlanId,
            NOT: {
              status: "CANCELED",
            },
          },
          select: { date: true, startTime: true },
        });

        // Check if the number of scheduled sessions is already at the limit
        if (existingAppointments.length >= planProcedure.contractedSessions) {
          const scheduledDates = existingAppointments.map((apt) =>
            format(new Date(apt.date), "dd/MM/yyyy", { locale: ptBR })
          );
          throw new SessionLimitError(
            `Todas as ${planProcedure.contractedSessions} sessões contratadas já foram agendadas.`,
            scheduledDates
          );
        }
      }
    }
    // --- NEW VALIDATION LOGIC ENDS HERE ---

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
