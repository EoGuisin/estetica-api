import { prisma } from "../lib/prisma";
import {
  Prisma,
  CommissionStatus,
  CommissionTriggerEvent,
} from "@prisma/client";
import { MarkCommissionAsPaidInput } from "../schemas/commissionRecord.schema";

// Interface para os dados necessários para criar um registro de comissão
interface CreateCommissionRecordData {
  clinicId: string;
  professionalId: string;
  treatmentPlanId: string;
  paymentInstallmentId?: string; // Opcional, se a comissão for por parcela
  calculatedAmount: number | Prisma.Decimal;
}

export class CommissionRecordService {
  /**
   * (Método Interno) Cria um registro de comissão.
   */
  static async create(
    tx: Prisma.TransactionClient,
    data: CreateCommissionRecordData
  ) {
    if (
      typeof data.calculatedAmount !== "number" &&
      !(data.calculatedAmount instanceof Prisma.Decimal)
    ) {
      throw new TypeError("calculatedAmount deve ser um número ou Decimal.");
    }
    if (Number(data.calculatedAmount) < 0) {
      console.warn(
        `Tentativa de criar comissão com valor negativo (${data.calculatedAmount}) para o plano ${data.treatmentPlanId}. Comissão não será criada.`
      );
      return null;
    }

    return tx.commissionRecord.create({
      data: {
        ...data,
        calculatedAmount: new Prisma.Decimal(data.calculatedAmount.toString()),
        status: CommissionStatus.PENDING,
        calculationDate: new Date(),
      },
    });
  }

  /**
   * Calcula e registra a comissão baseada em um TreatmentPlan.
   */
  static async calculateAndRecordCommissionForPlan(
    tx: Prisma.TransactionClient,
    treatmentPlanId: string,
    paymentInstallmentId?: string
  ) {
    // 1. Busca dados essenciais
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      include: {
        seller: {
          include: {
            CommissionPlan: {
              include: { tiers: { orderBy: { minThreshold: "asc" } } },
            },
          },
        },
      },
    });

    if (!plan) return null; // Plano não existe

    // Validação robusta
    if (
      !plan?.seller?.CommissionPlan?.tiers ||
      plan.seller.CommissionPlan.tiers.length === 0
    ) {
      // Log silencioso ou warn
      return null;
    }

    const seller = plan.seller;
    const commissionPlan = seller.CommissionPlan;
    const tiers = commissionPlan!.tiers;
    const triggerEvent = commissionPlan!.triggerEvent;

    // 2. Verifica Idempotência
    const existingCommissionWhere: Prisma.CommissionRecordWhereInput = {
      treatmentPlanId: treatmentPlanId,
      status: { in: [CommissionStatus.PENDING, CommissionStatus.PAID] },
      clinicId: plan.clinicId, // SEGURANÇA: Garante escopo
    };

    if (
      triggerEvent === CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID &&
      paymentInstallmentId
    ) {
      existingCommissionWhere.paymentInstallmentId = paymentInstallmentId;
    }
    const existingCommission = await tx.commissionRecord.findFirst({
      where: existingCommissionWhere,
    });

    if (existingCommission) {
      return null;
    }

    // 3. Define a Base de Cálculo
    let commissionBaseAmountDecimal = plan.total;
    if (
      triggerEvent === CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID &&
      paymentInstallmentId
    ) {
      const installment = await tx.paymentInstallment.findUnique({
        where: { id: paymentInstallmentId },
      });
      if (installment) {
        commissionBaseAmountDecimal = installment.amountDue;
      } else {
        return null;
      }
    }
    const commissionBaseAmount = Number(commissionBaseAmountDecimal);

    // 4. Encontra a Faixa de Comissão Aplicável
    let applicableTier = null;
    for (const tier of tiers) {
      const min = Number(tier.minThreshold);
      const max = tier.maxThreshold ? Number(tier.maxThreshold) : null;

      if (commissionBaseAmount < min && tiers.indexOf(tier) === 0) {
        applicableTier = null;
        break;
      }

      if (
        commissionBaseAmount >= min &&
        (max === null || commissionBaseAmount <= max)
      ) {
        applicableTier = tier;
        break;
      }

      if (
        tiers.indexOf(tier) === tiers.length - 1 &&
        max === null &&
        commissionBaseAmount >= min
      ) {
        applicableTier = tier;
        break;
      }
    }

    if (!applicableTier) {
      return null;
    }

    // 5. Calcula o Valor
    const commissionAmount =
      (commissionBaseAmount * Number(applicableTier.percentage)) / 100;

    // 6. Cria o Registro
    return CommissionRecordService.create(tx, {
      clinicId: plan.clinicId, // Usa o ID do plano validado
      professionalId: seller.id,
      treatmentPlanId: plan.id,
      paymentInstallmentId: paymentInstallmentId,
      calculatedAmount: commissionAmount,
    });
  }

  /**
   * Lista os registros de comissão com filtros e paginação.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      professionalId?: string;
      status?: CommissionStatus;
      dateStart?: string;
      dateEnd?: string;
    }
  ) {
    const where: Prisma.CommissionRecordWhereInput = { clinicId }; // SEGURANÇA

    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.status) where.status = filters.status;
    if (filters.dateStart || filters.dateEnd) {
      where.calculationDate = {};
      if (filters.dateStart)
        where.calculationDate.gte = new Date(filters.dateStart);
      if (filters.dateEnd)
        where.calculationDate.lte = new Date(filters.dateEnd);
    }

    const skip = (page - 1) * pageSize;
    const [records, totalCount] = await prisma.$transaction([
      prisma.commissionRecord.findMany({
        where,
        include: {
          professional: { select: { fullName: true } },
          treatmentPlan: {
            select: { id: true, patient: { select: { name: true } } },
          },
        },
        skip,
        take: pageSize,
        orderBy: { calculationDate: "desc" },
      }),
      prisma.commissionRecord.count({ where }),
    ]);

    return { data: records, totalCount };
  }

  /**
   * Marca uma comissão como paga.
   */
  static async markAsPaid(
    id: string,
    clinicId: string,
    data: MarkCommissionAsPaidInput
  ) {
    // SEGURANÇA: Garante que a comissão pertence à clínica
    await prisma.commissionRecord.findFirstOrThrow({
      where: {
        id,
        clinicId,
        status: CommissionStatus.PENDING,
      },
    });

    return prisma.commissionRecord.update({
      where: { id },
      data: {
        status: CommissionStatus.PAID,
        paymentDate: new Date(data.paymentDate),
      },
    });
  }
}
