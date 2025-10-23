import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus } from "@prisma/client";
import { RegisterPaymentInput } from "../schemas/paymentInstallment.schema";
import { CommissionRecordService } from "./commissionRecord.service";
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
      const installment = await tx.paymentInstallment.findFirstOrThrow({
        where: {
          id,
          clinicId /* Removido filtro de status aqui para permitir múltiplos pagamentos parciais */,
        },
        include: { treatmentPlan: true },
      });

      // --- LÓGICA DE PAGAMENTO PARCIAL ---
      // Calcula o total já pago anteriormente nesta parcela
      const currentPaidAmount = Number(installment.paidAmount || 0);
      const newlyPaidAmount = Number(data.paidAmount);
      const totalPaid = currentPaidAmount + newlyPaidAmount;
      const amountDue = Number(installment.amountDue);
      const remainingDue = amountDue - totalPaid;

      // Define o novo status
      let newStatus = installment.status;
      if (totalPaid >= amountDue) {
        newStatus = PaymentStatus.PAID; // Quitada!
      } else if (totalPaid > 0 && totalPaid < amountDue) {
        // Poderíamos introduzir um status PARTIALLY_PAID se necessário,
        // mas por enquanto, mantemos PENDING/OVERDUE até quitar.
        // Apenas atualizamos o valor pago. Se estava OVERDUE, continua OVERDUE.
        newStatus =
          installment.status === PaymentStatus.OVERDUE
            ? PaymentStatus.OVERDUE
            : PaymentStatus.PENDING;
      } else if (
        totalPaid <= 0 &&
        installment.status !== PaymentStatus.CANCELED
      ) {
        // Se o pagamento for 0 ou negativo e não estiver cancelada, volta a PENDING/OVERDUE
        newStatus =
          installment.dueDate < new Date()
            ? PaymentStatus.OVERDUE
            : PaymentStatus.PENDING;
      }
      // ------------------------------------

      const updatedInstallment = await tx.paymentInstallment.update({
        where: { id },
        data: {
          status: newStatus,
          // --- ATUALIZAÇÃO CUMULATIVA ---
          paidAmount: new Prisma.Decimal(totalPaid.toFixed(2)), // Salva o total pago acumulado
          // --------------------------
          // Guarda o último detalhe de pagamento (data, método, notas do último pagamento)
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          notes: data.notes, // Sobrescreve notas anteriores ou concatena? Decidimos sobrescrever por simplicidade.
        },
      });

      // --- DISPARAR CÁLCULO DE COMISSÃO ---
      // Verifica se a parcela foi TOTALMENTE paga AGORA para disparar a comissão
      // (Ajuste esta condição se a regra for diferente, ex: liberar comissão no primeiro pagamento parcial)
      if (
        newStatus === PaymentStatus.PAID &&
        installment.status !== PaymentStatus.PAID
      ) {
        console.log(
          `Disparando cálculo de comissão para plano ${installment.treatmentPlanId} via parcela ${updatedInstallment.id}`
        );
        await CommissionRecordService.calculateAndRecordCommissionForPlan(
          tx,
          installment.treatmentPlanId,
          updatedInstallment.id
        );
      } else {
        console.log(
          `Parcela ${updatedInstallment.id} não quitada (${newStatus}, ${totalPaid}/${amountDue}), comissão não disparada/recalculada.`
        );
      }
      // --- FIM DO AJUSTE ---

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
            select: {
              id: true,
              patient: { select: { id: true, name: true } },
              _count: { select: { paymentInstallments: true } },
            },
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
