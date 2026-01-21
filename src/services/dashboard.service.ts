import { prisma } from "../lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

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
    // CORREÇÃO 1: Garantir que a busca cubra do primeiro segundo do dia de início
    // até o último segundo do dia final, ignorando fusos horários quebrados.
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    const whereClause: any = {
      // CORREÇÃO 2: Filtrar pelo clinicId do PACIENTE, que é garantido,
      // ou garantir que o profissional pertença à clínica (ou seja o dono)
      patient: {
        clinicId: clinicId,
      },
      date: {
        gte: start,
        lte: end,
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
        treatmentPlan: {
          include: {
            seller: { select: { fullName: true } },
            appointments: {
              select: {
                id: true,
                date: true,
                status: true,
                treatmentPlanProcedureId: true,
              },
            },
            procedures: {
              select: {
                id: true,
                contractedSessions: true,
                completedSessions: true,
                procedure: { select: { name: true } },
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
