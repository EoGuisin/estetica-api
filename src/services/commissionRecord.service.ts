import { prisma } from "../lib/prisma";
import {
  Prisma,
  CommissionStatus,
  CommissionTriggerEvent,
} from "@prisma/client";
import { MarkCommissionAsPaidInput } from "../schemas/commissionRecord.schema";

// Interface interna para criação
interface CreateCommissionRecordData {
  clinicId: string;
  professionalId: string;
  treatmentPlanId: string;
  paymentInstallmentId?: string;
  calculatedAmount: number | Prisma.Decimal;
}
// Interface para os dados necessários para criar um registro de comissão
// Usado internamente por outros serviços
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
   * Chamado por outros serviços (ex: PaymentInstallmentService).
   * Usamos 'tx' para garantir que seja chamado dentro de uma transação.
   */
  static async create(
    tx: Prisma.TransactionClient,
    data: CreateCommissionRecordData
  ) {
    // Adiciona validação básica para garantir que o valor é numérico e não negativo
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
      return null; // Ou lançar um erro, dependendo da regra de negócio
    }

    return tx.commissionRecord.create({
      data: {
        ...data,
        calculatedAmount: new Prisma.Decimal(data.calculatedAmount.toString()), // Garante que é Decimal
        status: CommissionStatus.PENDING,
        calculationDate: new Date(),
      },
    });
  }

  /**
   * Calcula e registra a comissão baseada em um TreatmentPlan.
   * Regra Exemplo: Comissão é X% sobre o valor TOTAL do plano, liberada quando a PRIMEIRA parcela é paga.
   */
  static async calculateAndRecordCommissionForPlan(
    tx: Prisma.TransactionClient,
    treatmentPlanId: string,
    paymentInstallmentId?: string // Opcional: ID da parcela que foi paga (relevante para alguns gatilhos)
  ) {
    // 1. Busca dados essenciais (Plano, Vendedor, Plano de Comissão, Tiers)
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

    // Validação robusta
    if (
      !plan?.seller?.CommissionPlan?.tiers ||
      plan.seller.CommissionPlan.tiers.length === 0
    ) {
      console.warn(
        `Plano ${treatmentPlanId} ou vendedor/plano de comissão não encontrado/configurado para cálculo.`
      );
      return null;
    }

    const seller = plan.seller;
    const commissionPlan = seller.CommissionPlan; // Sabemos que existe
    const tiers = commissionPlan!.tiers;
    const triggerEvent = commissionPlan!.triggerEvent; // Pega o gatilho configurado

    // 2. Verifica Idempotência (Não recalcular se já existe PENDING/PAID para o mesmo gatilho/item)
    const existingCommissionWhere: Prisma.CommissionRecordWhereInput = {
      treatmentPlanId: treatmentPlanId,
      status: { in: [CommissionStatus.PENDING, CommissionStatus.PAID] },
    };
    // Se for por parcela, a chave de idempotência inclui a parcela
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
      console.log(
        `Comissão já registrada/paga para ${
          paymentInstallmentId
            ? `parcela ${paymentInstallmentId}`
            : `plano ${treatmentPlanId}`
        } conforme gatilho ${triggerEvent}.`
      );
      return null; // Evita duplicação
    }

    // 3. Define a Base de Cálculo da Comissão
    let commissionBaseAmountDecimal = plan.total; // Padrão: Total do plano
    if (
      triggerEvent === CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID &&
      paymentInstallmentId
    ) {
      const installment = await tx.paymentInstallment.findUnique({
        where: { id: paymentInstallmentId },
      });
      if (installment) {
        commissionBaseAmountDecimal = installment.amountDue; // Base é o valor da parcela
        console.log(
          `Calculando comissão ON_EACH_INSTALLMENT_PAID sobre ${commissionBaseAmountDecimal} da parcela ${paymentInstallmentId}`
        );
      } else {
        console.warn(
          `Parcela ${paymentInstallmentId} não encontrada para cálculo de comissão por parcela.`
        );
        return null;
      }
    }
    const commissionBaseAmount = Number(commissionBaseAmountDecimal); // Converte para número para comparações

    // 4. Encontra a Faixa de Comissão Aplicável
    let applicableTier = null;
    for (const tier of tiers) {
      const min = Number(tier.minThreshold);
      const max = tier.maxThreshold ? Number(tier.maxThreshold) : null; // Converte max para número ou null

      // Se base for menor que o mínimo da primeira faixa, não aplica nenhuma
      if (commissionBaseAmount < min && tiers.indexOf(tier) === 0) {
        console.log(
          `Valor base ${commissionBaseAmount} abaixo da primeira faixa (${min}) para ${seller.fullName}.`
        );
        applicableTier = null;
        break;
      }

      // Verifica se está dentro da faixa
      if (
        commissionBaseAmount >= min &&
        (max === null || commissionBaseAmount <= max)
      ) {
        applicableTier = tier;
        break; // Encontrou
      }

      // Se chegou na última faixa, ela não tem limite e a base é maior ou igual ao mínimo dela, aplica
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
      console.warn(
        `Nenhuma faixa de comissão encontrada para ${
          seller.fullName
        } no valor base ${commissionBaseAmount} (Plano: ${
          commissionPlan!.name
        }).`
      );
      return null;
    }

    // 5. Calcula o Valor da Comissão
    const commissionAmount =
      (commissionBaseAmount * Number(applicableTier.percentage)) / 100;

    // 6. Cria o Registro de Comissão
    console.log(
      `Criando registro de comissão: ${commissionAmount} para ${
        seller.fullName
      } (Plano: ${treatmentPlanId}, Parcela: ${paymentInstallmentId || "N/A"})`
    );
    return CommissionRecordService.create(tx, {
      clinicId: plan.clinicId,
      professionalId: seller.id,
      treatmentPlanId: plan.id,
      paymentInstallmentId: paymentInstallmentId, // Passa ID da parcela se aplicável
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
      dateEnd?: string; // Filtrar por calculationDate
    }
  ) {
    const where: Prisma.CommissionRecordWhereInput = { clinicId };

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
    await prisma.commissionRecord.findFirstOrThrow({
      where: {
        id,
        clinicId,
        status: CommissionStatus.PENDING, // Só pode pagar o que está pendente
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
