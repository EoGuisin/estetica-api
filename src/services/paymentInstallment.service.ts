import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus, CommissionTriggerEvent } from "@prisma/client";
import { RegisterPaymentInput } from "../schemas/paymentInstallment.schema";
import { CommissionRecordService } from "./commissionRecord.service";

export class PaymentInstallmentService {
  /**
   * Registra o pagamento de uma parcela, lida com pagamentos parciais
   * e dispara o cálculo de comissão de acordo com a regra do plano.
   */
  static async registerPayment(
    id: string,
    clinicId: string,
    data: RegisterPaymentInput
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Busca Parcela e Plano
      const installment = await tx.paymentInstallment.findFirstOrThrow({
        where: { id, clinicId },
        include: {
          treatmentPlan: {
            include: {
              seller: { include: { CommissionPlan: true } },
              _count: { select: { paymentInstallments: true } },
            },
          },
        },
      });

      // Validações Iniciais
      if (installment.status === PaymentStatus.CANCELED) {
        throw new Error(
          "Parcela está cancelada e não pode receber pagamentos."
        );
      }
      if (installment.status === PaymentStatus.PAID) {
        throw new Error("Parcela já consta como totalmente paga."); // Mensagem mais clara
      }

      // 2. Lógica de Pagamento Parcial e Status - Refatorada
      const currentPaidAmount = Number(installment.paidAmount || 0);
      const newlyPaidAmount = Number(data.paidAmount);
      const totalPaid = currentPaidAmount + newlyPaidAmount;
      const amountDue = Number(installment.amountDue);
      const isOverdue = installment.dueDate < new Date(); // Verifica se já estava vencida

      let newStatus: PaymentStatus;

      if (totalPaid >= amountDue) {
        newStatus = PaymentStatus.PAID; // Quitada!
      } else if (totalPaid > 0) {
        // Se pagou algo mas não quitou, mantém PENDING ou OVERDUE
        newStatus = isOverdue ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
      } else {
        // Se o total pago for zero ou menos (ex: estorno?), volta ao status original baseado na data
        newStatus = isOverdue ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
      }

      // Variáveis para lógica de comissão
      const isFirstPaymentForThisInstallment =
        currentPaidAmount === 0 && newlyPaidAmount > 0;
      // Verifica se a parcela foi quitada NESTE pagamento (transição de !PAID para PAID)
      const isNowFullyPaid =
        newStatus === PaymentStatus.PAID &&
        (installment.status as PaymentStatus) !== PaymentStatus.PAID;

      // 3. Atualiza a Parcela
      const updatedInstallment = await tx.paymentInstallment.update({
        where: { id },
        data: {
          status: newStatus,
          paidAmount: new Prisma.Decimal(totalPaid.toFixed(2)), // Salva o total pago acumulado
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      });

      // --- LÓGICA REFINADA PARA DISPARAR COMISSÃO ---
      const commissionPlan = installment.treatmentPlan?.seller?.CommissionPlan;
      const triggerEvent = commissionPlan?.triggerEvent;

      let shouldCalculateCommission = false;
      let installmentIdForCommission: string | undefined =
        updatedInstallment.id;

      switch (triggerEvent) {
        case CommissionTriggerEvent.ON_SALE:
          console.log("Comissão ON_SALE, não dispara no pagamento.");
          break;

        case CommissionTriggerEvent.ON_FIRST_INSTALLMENT_PAID: {
          // <-- Adiciona Chaves {}
          const anyPreviousPayment = await tx.paymentInstallment.findFirst({
            where: {
              treatmentPlanId: installment.treatmentPlanId,
              paidAmount: { gt: 0 },
              id: { not: updatedInstallment.id },
            },
          });
          if (isFirstPaymentForThisInstallment && !anyPreviousPayment) {
            console.log(
              `Disparando comissão ON_FIRST_INSTALLMENT_PAID para plano ${installment.treatmentPlanId}`
            );
            shouldCalculateCommission = true;
            installmentIdForCommission = undefined;
          }
          break;
        } // <-- Fecha Chaves {}

        case CommissionTriggerEvent.ON_FULL_PLAN_PAID: {
          // <-- Adiciona Chaves {}
          if (isNowFullyPaid) {
            const totalInstallmentsCount =
              installment.treatmentPlan?._count?.paymentInstallments ?? 0;
            const paidInstallmentsCount = await tx.paymentInstallment.count({
              where: {
                treatmentPlanId: installment.treatmentPlanId,
                status: PaymentStatus.PAID,
              },
            });
            if (
              totalInstallmentsCount > 0 &&
              paidInstallmentsCount === totalInstallmentsCount
            ) {
              console.log(
                `Disparando comissão ON_FULL_PLAN_PAID para plano ${installment.treatmentPlanId}`
              );
              shouldCalculateCommission = true;
              installmentIdForCommission = undefined;
            } else {
              console.log(
                `Plano ${installment.treatmentPlanId} quitou parcela ${id}, mas ainda não está totalmente pago (${paidInstallmentsCount}/${totalInstallmentsCount}).`
              );
            }
          }
          break;
        } // <-- Fecha Chaves {}

        case CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID:
          if (isNowFullyPaid) {
            console.log(
              `Disparando comissão ON_EACH_INSTALLMENT_PAID para parcela ${updatedInstallment.id}`
            );
            shouldCalculateCommission = true;
            // Mantém installmentIdForCommission com o ID da parcela
          }
          break;

        default:
          console.log(
            "Nenhum gatilho de comissão configurado ou reconhecido para o vendedor."
          );
      }

      // Dispara o cálculo se necessário
      if (shouldCalculateCommission && installment.treatmentPlanId) {
        try {
          await CommissionRecordService.calculateAndRecordCommissionForPlan(
            tx,
            installment.treatmentPlanId,
            installmentIdForCommission
          );
          console.log(`Cálculo de comissão processado para ${triggerEvent}.`);
        } catch (commissionError: any) {
          console.error(
            `Erro ao calcular/registrar comissão ${triggerEvent}:`,
            commissionError.message
          );
          // throw commissionError; // Descomente se a falha na comissão deve reverter o pagamento
        }
      }
      // --- FIM DA LÓGICA REFINADA ---

      return updatedInstallment;
    });
  }

  /**
   * Lista as parcelas com filtros e paginação.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: PaymentStatus[];
      dueDateStart?: string;
      dueDateEnd?: string;
      patientName?: string;
      treatmentPlanId?: string;
    }
  ) {
    const where: Prisma.PaymentInstallmentWhereInput = { clinicId };
    const now = new Date();

    // Lógica de Status
    if (filters.status && filters.status.length > 0) {
      const directStatuses = filters.status.filter(
        (s) => s !== PaymentStatus.OVERDUE
      );
      const conditions: Prisma.PaymentInstallmentWhereInput[] = [];
      if (directStatuses.length > 0)
        conditions.push({ status: { in: directStatuses } });
      if (filters.status.includes(PaymentStatus.OVERDUE)) {
        conditions.push({
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        });
      }
      // Se NENHUM status direto foi selecionado E OVERDUE foi, ajusta a query
      // para pegar apenas PENDING+Vencido, senão pega (Status Diretos OU (PENDING+Vencido))
      if (
        directStatuses.length === 0 &&
        filters.status.includes(PaymentStatus.OVERDUE)
      ) {
        where.status = PaymentStatus.PENDING;
        where.dueDate = { lt: now };
      } else if (conditions.length > 0) {
        where.OR = conditions;
      }
    }

    // Filtros de Data
    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = { ...(where.dueDate as Prisma.DateTimeFilter) }; // Mantém filtro de OVERDUE se existir
      if (filters.dueDateStart)
        where.dueDate.gte = new Date(filters.dueDateStart);
      if (filters.dueDateEnd) where.dueDate.lte = new Date(filters.dueDateEnd);
    }

    // Filtro por Nome do Paciente
    if (filters.patientName) {
      // Combina com o filtro de clinicId existente
      where.treatmentPlan = {
        ...(where.treatmentPlan as Prisma.TreatmentPlanListRelationFilter), // Mantém outros filtros se houver
        patient: {
          name: { contains: filters.patientName, mode: "insensitive" },
        },
      };
    } else if (filters.treatmentPlanId) {
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

    // Adiciona o status 'OVERDUE' dinamicamente
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
          select: {
            id: true,
            patient: { select: { id: true, name: true } },
            _count: { select: { paymentInstallments: true } },
          },
        },
      },
    });
  }
}
