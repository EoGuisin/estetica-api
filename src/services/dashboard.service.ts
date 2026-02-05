import { prisma } from "../lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { Prisma } from "@prisma/client";

export class DashboardService {
  /**
   * Helper para verificar se o usuário tem visão restrita (vê apenas a si mesmo).
   */
  private static async checkRestriction(userId: string, clinicId: string) {
    // 1. Busca dados da Clínica
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });

    // 2. Busca dados do Usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !clinic) return true; // Por segurança, restringe se não achar

    // CHECK 1: É o Dono da Conta?
    if (clinic.account.ownerId === userId) {
      return false; // LIBERADO (Vê tudo)
    }

    // CHECK 2: É Admin, Comercial ou Secretária?
    const unrestrictedRoles = ["ADMIN", "COMMERCIAL", "SECRETARY"];
    if (user.role && unrestrictedRoles.includes(user.role.type)) {
      return false; // LIBERADO (Vê tudo)
    }

    // Se chegou aqui, é um profissional comum
    return true; // RESTRITO (Vê só a si mesmo)
  }

  /**
   * Busca os profissionais de uma clínica específica.
   */
  static async getProfessionals(clinicId: string, requestingUserId: string) {
    const isRestricted = await this.checkRestriction(
      requestingUserId,
      clinicId
    );

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });
    const ownerId = clinic?.account.ownerId;

    const whereClause: Prisma.UserWhereInput = {
      isProfessional: true,
      OR: [
        // Profissionais vinculados a esta clínica
        { clinics: { some: { id: clinicId } } },
        // OU o dono da conta (se for profissional)
        ...(ownerId ? [{ id: ownerId }] : []),
      ],
    };

    // --- APLICA A RESTRIÇÃO ---
    if (isRestricted) {
      // Se restrito, força o ID para ser apenas o do usuário logado
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

    const whereClause: Prisma.AppointmentWhereInput = {
      // SEGURANÇA CRÍTICA: Filtra pacientes desta clínica
      patient: {
        clinicId: clinicId,
      },
      date: {
        gte: start,
        lte: end,
      },
      status: { not: "CANCELED" }, // Opcional: geralmente dashboard não mostra cancelados ou mostra diferente
    };

    if (isRestricted) {
      // Se restrito, vê apenas seus próprios agendamentos
      whereClause.professionalId = requestingUserId;
    } else {
      // Se liberado, aplica filtro opcional de profissionais selecionados no front
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
            id: true,
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
