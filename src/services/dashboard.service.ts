// src/services/dashboard.service.ts
import { prisma } from "../lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

export class DashboardService {
  /**
   * Helper para verificar se o usuário tem visão restrita.
   */
  private static async checkRestriction(userId: string, clinicId: string) {
    // 1. Busca dados da Clínica (para saber quem é o dono da conta dela)
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });

    // 2. Busca dados do Usuário (para saber o cargo)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !clinic) return true; // Por segurança, bloqueia se não achar

    // DEBUG: Verifique isso no terminal do backend se ainda der erro
    console.log(`[DashboardAuth] User: ${user.fullName}`);
    console.log(`[DashboardAuth] Role: ${user.role?.type}`);
    console.log(`[DashboardAuth] Clinic Owner: ${clinic.account.ownerId}`);
    console.log(`[DashboardAuth] My ID: ${userId}`);

    // CHECK 1: É o Dono da Conta dessa clínica?
    if (clinic.account.ownerId === userId) {
      return false; // LIBERADO (Vê tudo)
    }

    // CHECK 2: É Admin, Comercial ou Secretária?
    const unrestrictedRoles = ["ADMIN", "COMMERCIAL", "SECRETARY"];
    if (user.role && unrestrictedRoles.includes(user.role.type)) {
      return false; // LIBERADO (Vê tudo)
    }

    // Se chegou aqui, é um profissional comum (não dono, não admin)
    return true; // RESTRITO (Vê só a si mesmo)
  }

  /**
   * Busca os profissionais de uma clínica específica.
   */
  static async getProfessionals(clinicId: string, requestingUserId: string) {
    // Verifica se deve restringir a lista
    const isRestricted = await this.checkRestriction(
      requestingUserId,
      clinicId
    );

    // Descobrir o ownerId para garantir que ele apareça na lista se for profissional
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });
    const ownerId = clinic?.account.ownerId;

    const whereClause: any = {
      isProfessional: true,
      OR: [
        // Profissionais vinculados a esta clínica (Tabela N:N)
        { clinics: { some: { id: clinicId } } },
        // OU o dono da conta (se ele for marcado como isProfessional)
        ...(ownerId ? [{ id: ownerId }] : []),
      ],
    };

    // --- APLICA A RESTRIÇÃO ---
    if (isRestricted) {
      // Se for restrito, forçamos o ID dele.
      // Isso fará a lista retornar apenas 1 item (ele mesmo).
      whereClause.id = requestingUserId;
    }

    return prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        color: true,
        workingDays: true,
        scheduleStartHour: true,
        scheduleEndHour: true,
      },
      orderBy: { fullName: "asc" },
    });
  }

  /**
   * Busca os agendamentos.
   */
  static async getAppointments(
    clinicId: string,
    requestingUserId: string,
    startDate: Date,
    endDate: Date,
    professionalIds?: string[]
  ) {
    const isRestricted = await this.checkRestriction(
      requestingUserId,
      clinicId
    );

    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    const whereClause: any = {
      patient: {
        clinicId: clinicId,
      },
      date: {
        gte: start,
        lte: end,
      },
    };

    // --- LÓGICA DE FILTRO DE PROFISSIONAIS ---
    if (isRestricted) {
      // Se é restrito, IGNORA o filtro do frontend e força ver só os seus
      whereClause.professionalId = requestingUserId;
    } else {
      // Se não é restrito (Dono/Admin), respeita o filtro do frontend (se houver)
      if (professionalIds && professionalIds.length > 0) {
        whereClause.professionalId = {
          in: professionalIds,
        };
      }
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
