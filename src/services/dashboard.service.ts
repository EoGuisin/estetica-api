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
    // Constrói a cláusula 'where' dinamicamente
    const whereClause: any = {
      professional: {
        clinicId: clinicId,
      },
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Adiciona o filtro de profissionais se ele for fornecido
    if (professionalIds && professionalIds.length > 0) {
      whereClause.professionalId = {
        in: professionalIds,
      };
    }

    return prisma.appointment.findMany({
      where: whereClause,
      include: {
        // 1. Paciente: Adicionar CPF e telefones
        patient: {
          select: {
            name: true,
            imageUrl: true,
            cpf: true, // Adicionado
            phones: true, // Adicionado
          },
        },

        // 2. Profissional: Já está OK para o modal
        professional: {
          select: {
            fullName: true,
            color: true,
          },
        },

        // 3. Tipo de Agendamento: Faltando completamente
        appointmentType: {
          select: {
            name: true,
          },
        },

        // 4. Plano de Tratamento: Faltando completamente
        treatmentPlan: {
          include: {
            seller: {
              select: {
                fullName: true,
              },
            },
            procedures: {
              select: {
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
