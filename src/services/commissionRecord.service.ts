import { prisma } from "../lib/prisma";
import { Prisma, CommissionStatus } from "@prisma/client";
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
    paymentInstallmentId: string
  ) {
    // 1. Verifica idempotência
    const existingCommission = await tx.commissionRecord.findFirst({
      where: {
        treatmentPlanId: treatmentPlanId,
        status: { in: [CommissionStatus.PENDING, CommissionStatus.PAID] },
      },
    });
    if (existingCommission) {
      console.log(
        `Comissão para o plano ${treatmentPlanId} já registrada ou paga.`
      );
      return null;
    }

    // 2. Busca dados
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      include: {
        seller: {
          include: {
            // Usar optional chaining aqui por segurança
            CommissionPlan: {
              include: { tiers: { orderBy: { minThreshold: "asc" } } },
            },
          },
        },
      },
    });

    // Validação robusta dos dados necessários
    if (
      !plan?.seller?.CommissionPlan?.tiers ||
      plan.seller.CommissionPlan.tiers.length === 0
    ) {
      console.warn(
        `Plano ${treatmentPlanId} ou vendedor/plano de comissão não encontrado/configurado.`
      );
      return null;
    }

    const seller = plan.seller;
    const commissionPlan = seller.CommissionPlan; // Agora sabemos que não é null
    const planTotal = plan.total;
    const tiers = commissionPlan!.tiers; // Sabemos que tiers existe e tem itens

    // 3. Encontra a faixa aplicável
    let applicableTier = null;
    // Itera pelas faixas ordenadas
    for (const tier of tiers) {
      const min = tier.minThreshold;
      const max = tier.maxThreshold;

      // Se o valor for menor que o mínimo da faixa atual, E não é a primeira faixa,
      // então a faixa anterior (se existir) seria a correta, mas como estamos ordenados,
      // significa que nenhuma faixa se aplica (ou a comissão seria 0).
      // Simplificamos: se for menor que o mínimo da primeira faixa, não aplica.
      if (planTotal < min && tiers.indexOf(tier) === 0) {
        console.log(
          `Valor ${planTotal} abaixo da primeira faixa (${min}) para ${seller.fullName}.`
        );
        applicableTier = null; // Garante que não aplicará nenhuma
        break;
      }

      // Verifica se está dentro da faixa (com ou sem limite máximo)
      if (planTotal >= min && (max === null || planTotal <= max)) {
        applicableTier = tier;
        break; // Encontrou a faixa correta
      }

      // Se chegou na última faixa e ainda não encontrou, mas a última não tem limite, aplica ela
      if (
        tiers.indexOf(tier) === tiers.length - 1 &&
        max === null &&
        planTotal >= min
      ) {
        applicableTier = tier;
        break;
      }
    }

    if (!applicableTier) {
      console.warn(
        `Nenhuma faixa de comissão encontrada para ${seller.fullName} no valor ${planTotal} (${commissionPlan!.name}).`
      );
      return null;
    }

    // 4. Calcula o valor
    const commissionAmount =
      (Number(planTotal) * Number(applicableTier.percentage)) / 100;

    // 5. Cria o registro
    return CommissionRecordService.create(tx, {
      clinicId: plan.clinicId,
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
