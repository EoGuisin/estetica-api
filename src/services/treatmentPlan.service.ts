// src/services/treatmentPlan.service.ts
import {
  CommissionTriggerEvent,
  PaymentStatus,
  TreatmentPlanStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CreateTreatmentPlanInput } from "../schemas/treatmentPlan.schema";
import { CommissionRecordService } from "./commissionRecord.service";

export class TreatmentPlanService {
  // --- MÉTODO PRIVADO: GERA FINANCEIRO E COMISSÃO ---
  // Reutilizável para Criação Direta e Aprovação
  private static async generateFinancials(
    tx: any,
    planId: string,
    clinicId: string,
    totalAmount: number,
    numberOfInstallments: number,
    firstDueDate?: Date
  ) {
    const installmentAmount = Number.parseFloat(
      (Number(totalAmount) / numberOfInstallments).toFixed(2)
    );
    const lastInstallmentAmount =
      Number(totalAmount) - installmentAmount * (numberOfInstallments - 1);

    const installmentsData = [];
    let currentDueDate = firstDueDate ? new Date(firstDueDate) : new Date();

    // Se não veio data e estamos gerando agora, joga pra 30 dias (ou mantém hoje se for entrada)
    // Ajuste conforme sua regra de negócio. Aqui vou assumir que se não tem data, é D+30
    if (!firstDueDate) {
      currentDueDate.setDate(currentDueDate.getDate() + 30);
    }

    for (let i = 1; i <= numberOfInstallments; i++) {
      installmentsData.push({
        treatmentPlanId: planId,
        clinicId: clinicId,
        installmentNumber: i,
        dueDate: new Date(currentDueDate),
        amountDue:
          i === numberOfInstallments
            ? lastInstallmentAmount
            : installmentAmount,
        status: PaymentStatus.PENDING,
      });
      currentDueDate.setMonth(currentDueDate.getMonth() + 1);
    }

    await tx.paymentInstallment.createMany({ data: installmentsData });

    // Comissão
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: planId },
      select: { sellerId: true, seller: { include: { CommissionPlan: true } } },
    });

    if (
      plan?.seller?.CommissionPlan?.triggerEvent ===
      CommissionTriggerEvent.ON_SALE
    ) {
      await CommissionRecordService.calculateAndRecordCommissionForPlan(
        tx,
        planId
      );
    }
  }

  static async create(
    clinicId: string,
    data: CreateTreatmentPlanInput & { isBudget?: boolean }
  ) {
    const { procedures, paymentTerms, isBudget, ...planData } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Cria o Plano (DRAFT ou APPROVED)
      const newPlan = await tx.treatmentPlan.create({
        data: {
          ...planData,
          clinicId,
          status: isBudget
            ? TreatmentPlanStatus.DRAFT
            : TreatmentPlanStatus.APPROVED,
          installmentCount: paymentTerms.numberOfInstallments, // Salva para usar depois se for draft
          procedures: {
            create: procedures.map((proc) => ({
              procedureId: proc.procedureId,
              contractedSessions: proc.contractedSessions,
              unitPrice: proc.unitPrice,
              followUps: proc.followUps,
            })),
          },
        },
      });

      // 2. Se NÃO for orçamento, gera o financeiro agora
      if (!isBudget) {
        await this.generateFinancials(
          tx,
          newPlan.id,
          clinicId,
          Number(newPlan.total),
          paymentTerms.numberOfInstallments,
          paymentTerms.firstDueDate
            ? new Date(paymentTerms.firstDueDate)
            : undefined
        );
      }

      return newPlan;
    });
  }

  // --- NOVO: APROVAR ORÇAMENTO ---
  static async approve(id: string, clinicId: string) {
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id, clinicId },
      include: { paymentInstallments: true },
    });

    if (!plan) throw new Error("Plano não encontrado.");
    if (plan.status !== TreatmentPlanStatus.DRAFT)
      throw new Error("Este plano já foi aprovado ou cancelado.");

    return prisma.$transaction(async (tx) => {
      // Gera o financeiro baseado no que foi salvo no draft
      await this.generateFinancials(
        tx,
        plan.id,
        clinicId,
        Number(plan.total),
        plan.installmentCount || 1, // Fallback se estiver nulo
        new Date() // Data da primeira parcela = Hoje (ou lógica de D+30) ao aprovar
      );

      return tx.treatmentPlan.update({
        where: { id },
        data: { status: TreatmentPlanStatus.APPROVED },
      });
    });
  }

  // --- NOVO: DELETAR COM SEGURANÇA ---
  static async delete(id: string, clinicId: string) {
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id, clinicId },
      include: {
        paymentInstallments: true,
        commissionRecords: true,
        appointments: true, // Para verificar se já atendeu
      },
    });

    if (!plan) throw new Error("Plano não encontrado.");

    // VERIFICAÇÃO DE SEGURANÇA
    const hasPaidInstallment = plan.paymentInstallments.some(
      (p) => p.status === PaymentStatus.PAID
    );
    const hasPaidCommission = plan.commissionRecords.some(
      (c) => c.status === "PAID"
    ); // Ajuste conforme seu Enum de comissão
    const hasCompletedAppointment = plan.appointments.some(
      (a) => a.status === "COMPLETED" || a.status === "CONFIRMED"
    );

    if (hasPaidInstallment || hasPaidCommission) {
      throw new Error(
        "SEGURANÇA: Não é possível excluir uma venda com movimentações financeiras (parcelas pagas ou comissões pagas). Realize o estorno ou cancelamento."
      );
    }

    if (hasCompletedAppointment) {
      throw new Error(
        "SEGURANÇA: Existem agendamentos concluídos vinculados a este plano. Desvincule os agendamentos antes de excluir."
      );
    }

    // Se passou, deleta tudo (Cascade do Prisma deve cuidar das relações, mas garantimos aqui)
    return prisma.$transaction(async (tx) => {
      // Opcional: deletar explicitamente para garantir ordem, mas se o schema tiver onDelete: Cascade, basta deletar o plano
      await tx.commissionRecord.deleteMany({ where: { treatmentPlanId: id } });
      await tx.paymentInstallment.deleteMany({
        where: { treatmentPlanId: id },
      });
      await tx.treatmentPlanProcedure.deleteMany({
        where: { treatmentPlanId: id },
      });

      // Desvincula agendamentos futuros (não deleta o agendamento, só tira o plano)
      await tx.appointment.updateMany({
        where: { treatmentPlanId: id },
        data: { treatmentPlanId: null, treatmentPlanProcedureId: null },
      });

      await tx.treatmentPlan.delete({ where: { id } });
    });
  }

  static async list(clinicId: string) {
    // A listagem pode incluir a contagem de parcelas totais e pagas, se útil
    return prisma.treatmentPlan.findMany({
      where: { clinicId },
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        _count: { select: { procedures: true, paymentInstallments: true } },
        paymentInstallments: {
          where: { status: PaymentStatus.PAID },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getById(id: string, clinicId: string) {
    return prisma.treatmentPlan.findFirst({
      where: { id, clinicId },
      include: {
        patient: true,
        seller: true,
        procedures: {
          include: {
            procedure: true,
          },
        },
        // Inclui parcelas ordenadas ao buscar detalhes
        paymentInstallments: {
          orderBy: { installmentNumber: "asc" },
        },
      },
    });
  }
}
