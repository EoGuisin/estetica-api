import { prisma } from "../lib/prisma";

export class DashboardService {
  /**
   * Busca os profissionais de uma clínica específica.
   */
  static async getProfessionals(clinicId: string) {
    return prisma.user.findMany({
      where: {
        clinicId: clinicId,
        isProfessional: true,
      },
      select: {
        id: true,
        fullName: true,
        color: true,
      },
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
