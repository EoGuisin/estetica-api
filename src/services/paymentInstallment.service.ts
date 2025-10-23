import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus } from "@prisma/client";
import { RegisterPaymentInput } from "../schemas/paymentInstallment.schema";
// Placeholder: Importaremos o CommissionService quando ele existir
// import { CommissionService } from "./commission.service";

export class PaymentInstallmentService {
  /**
   * Registra o pagamento de uma parcela.
   */
  static async registerPayment(
    id: string,
    clinicId: string,
    data: RegisterPaymentInput
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Busca a parcela e garante que pertence à clínica e está pendente/vencida
      const installment = await tx.paymentInstallment.findFirstOrThrow({
        where: {
          id,
          clinicId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        },
        include: {
          treatmentPlan: true, // Inclui para possível cálculo de comissão
        },
      });

      // 2. Define o status como PAGO
      const newStatus = PaymentStatus.PAID;

      // 3. Atualiza a parcela com os dados do pagamento
      const updatedInstallment = await tx.paymentInstallment.update({
        where: { id },
        data: {
          status: newStatus,
          paidAmount: data.paidAmount, // Idealmente, validar se paidAmount >= amountDue ou permitir pagamento parcial
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      });

      // 4. TODO: Disparar o cálculo de comissão (quando o CommissionService existir)
      // Esta lógica dependerá se a comissão é liberada por parcela ou pelo plano total.
      // Exemplo: Se for liberada por parcela:
      // await CommissionService.calculateAndRecordCommission(tx, installment.treatmentPlanId, updatedInstallment.id);
      // Exemplo: Se for liberada ao quitar o plano (verificar se todas as parcelas estão pagas):
      // const allInstallments = await tx.paymentInstallment.findMany({ where: { treatmentPlanId: installment.treatmentPlanId } });
      // const allPaid = allInstallments.every(inst => inst.status === PaymentStatus.PAID);
      // if (allPaid) {
      //    await CommissionService.calculateAndRecordCommission(tx, installment.treatmentPlanId);
      // }

      return updatedInstallment;
    });
  }

  /**
   * Lista as parcelas com filtros e paginação.
   * Inclui lógica para identificar parcelas vencidas dinamicamente.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: PaymentStatus[];
      dueDateStart?: string;
      dueDateEnd?: string;
      patientId?: string;
      treatmentPlanId?: string;
    }
  ) {
    const where: Prisma.PaymentInstallmentWhereInput = { clinicId };
    const now = new Date();

    // Lógica de Status: PENDING, PAID, CANCELED são diretos. OVERDUE é PENDING + dueDate < now
    if (filters.status && filters.status.length > 0) {
      const directStatuses = filters.status.filter(
        (s) => s !== PaymentStatus.OVERDUE
      );
      const conditions: Prisma.PaymentInstallmentWhereInput[] = [];

      if (directStatuses.length > 0) {
        conditions.push({ status: { in: directStatuses } });
      }
      if (filters.status.includes(PaymentStatus.OVERDUE)) {
        conditions.push({
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        });
      }

      where.OR = conditions; // Usa OR para combinar PENDING+OVERDUE com outros status
    }

    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = {};
      if (filters.dueDateStart)
        where.dueDate.gte = new Date(filters.dueDateStart);
      if (filters.dueDateEnd) where.dueDate.lte = new Date(filters.dueDateEnd);
    }
    if (filters.patientId) {
      where.treatmentPlan = { patientId: filters.patientId };
    }
    if (filters.treatmentPlanId) {
      where.treatmentPlanId = filters.treatmentPlanId;
    }

    const skip = (page - 1) * pageSize;
    const [installments, totalCount] = await prisma.$transaction([
      prisma.paymentInstallment.findMany({
        where,
        include: {
          treatmentPlan: {
            select: { id: true, patient: { select: { id: true, name: true } } },
          },
        },
        skip,
        take: pageSize,
        orderBy: { dueDate: "asc" },
      }),
      prisma.paymentInstallment.count({ where }),
    ]);

    // Adiciona o status 'OVERDUE' dinamicamente para exibição no frontend se necessário
    const installmentsWithStatus = installments.map((inst) => ({
      ...inst,
      status:
        inst.status === PaymentStatus.PENDING && inst.dueDate < now
          ? PaymentStatus.OVERDUE
          : inst.status,
    }));

    return { data: installmentsWithStatus, totalCount };
  }

  /**
   * Busca uma parcela específica pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.paymentInstallment.findFirst({
      where: { id, clinicId },
      include: {
        treatmentPlan: {
          select: { id: true, patient: { select: { id: true, name: true } } },
        },
      },
    });
  }

  // Update e Delete não são tipicamente necessários para parcelas individuais
  // A gestão é feita via TreatmentPlan ou registrando pagamento.
}
