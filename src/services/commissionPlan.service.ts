import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateCommissionPlanInput,
  UpdateCommissionPlanInput,
} from "../schemas/commission.schema";

export class CommissionPlanService {
  /**
   * Cria um novo plano de comissão e suas faixas (tiers) de forma transacional.
   */
  static async create(data: CreateCommissionPlanInput, clinicId: string) {
    const { tiers, ...planData } = data;

    return prisma.commissionPlan.create({
      data: {
        ...planData,
        clinicId,
        tiers: {
          create: tiers, // Prisma cria as faixas relacionadas
        },
      },
      include: { tiers: { orderBy: { minThreshold: "asc" } } },
    });
  }

  /**
   * Lista os planos de comissão da clínica.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.CommissionPlanWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [plans, totalCount] = await prisma.$transaction([
      prisma.commissionPlan.findMany({
        where,
        include: { tiers: { orderBy: { minThreshold: "asc" } } },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.commissionPlan.count({ where }),
    ]);

    return { data: plans, totalCount };
  }

  /**
   * Busca um plano de comissão específico pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.commissionPlan.findFirst({
      where: { id, clinicId },
      include: { tiers: { orderBy: { minThreshold: "asc" } } },
    });
  }

  /**
   * Atualiza um plano de comissão. A estratégia é substituir todas as faixas antigas pelas novas.
   */
  static async update(
    id: string,
    data: UpdateCommissionPlanInput,
    clinicId: string
  ) {
    const { tiers, ...planData } = data;

    return prisma.$transaction(async (tx) => {
      // Garante que o plano pertence à clínica
      await tx.commissionPlan.findFirstOrThrow({ where: { id, clinicId } });

      // Atualiza os dados do plano (nome, descrição, etc.)
      const updatedPlan = await tx.commissionPlan.update({
        where: { id },
        data: { ...planData },
      });

      // Se novas faixas foram enviadas, substitui as antigas
      if (tiers) {
        // 1. Deleta todas as faixas antigas
        await tx.commissionTier.deleteMany({ where: { commissionPlanId: id } });
        // 2. Cria as novas faixas
        await tx.commissionTier.createMany({
          data: tiers.map((tier) => ({ ...tier, commissionPlanId: id })),
        });
      }

      // Retorna o plano completo e atualizado
      return tx.commissionPlan.findUnique({
        where: { id },
        include: { tiers: { orderBy: { minThreshold: "asc" } } },
      });
    });
  }

  /**
   * Deleta um plano, verificando se ele não está em uso por algum profissional.
   */
  static async delete(id: string, clinicId: string) {
    await prisma.commissionPlan.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Impede a exclusão se o plano estiver vinculado a um usuário.
    const userCount = await prisma.user.count({
      where: { commissionPlanId: id },
    });

    if (userCount > 0) {
      throw new Error("PLAN_IN_USE");
    }

    // A exclusão dos tiers acontece em cascata (onDelete: Cascade no Prisma schema)
    return prisma.commissionPlan.delete({ where: { id } });
  }
}
