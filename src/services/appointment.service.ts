// src/services/appointment.service.ts
import { prisma } from "../lib/prisma";
import { CreateAppointmentInput } from "../schemas/appointment.schema";

export class AppointmentService {
  static async create(clinicId: string, data: CreateAppointmentInput) {
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
