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

    // SEGURANÇA: Verificar se paciente pertence à clínica
    const patientCheck = await prisma.patient.findFirst({
      where: { id: planData.patientId, clinicId },
    });
    if (!patientCheck)
      throw new Error("Paciente não encontrado ou acesso negado.");

    // SEGURANÇA: Verificar se vendedor pertence à clínica
    const sellerCheck = await prisma.user.findFirst({
      where: { id: planData.sellerId, clinics: { some: { id: clinicId } } },
    });
    if (!sellerCheck)
      throw new Error("Vendedor não encontrado ou acesso negado.");

    return prisma.$transaction(async (tx) => {
      // 1. Cria o Plano (DRAFT ou APPROVED)
      const newPlan = await tx.treatmentPlan.create({
        data: {
          ...planData,
          clinicId, // Vínculo forçado
          status: isBudget
            ? TreatmentPlanStatus.DRAFT
            : TreatmentPlanStatus.APPROVED,
          installmentCount: paymentTerms.numberOfInstallments,
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

  // --- APROVAR ORÇAMENTO ---
  static async approve(id: string, clinicId: string) {
    // SEGURANÇA: findUnique com clinicId composto ou findFirst
    // Como id é único, findUnique é ok, mas findFirst com clinicId é mais seguro para garantir acesso
    const plan = await prisma.treatmentPlan.findFirst({
      where: { id, clinicId }, // SEGURANÇA
      include: { paymentInstallments: true },
    });

    if (!plan) throw new Error("Plano não encontrado.");
    if (plan.status !== TreatmentPlanStatus.DRAFT)
      throw new Error("Este plano já foi aprovado ou cancelado.");

    return prisma.$transaction(async (tx) => {
      await this.generateFinancials(
        tx,
        plan.id,
        clinicId,
        Number(plan.total),
        plan.installmentCount || 1,
        new Date() // Data da primeira parcela = Hoje (ou lógica de D+30) ao aprovar
      );

      return tx.treatmentPlan.update({
        where: { id },
        data: { status: TreatmentPlanStatus.APPROVED },
      });
    });
  }

  static async update(
    id: string,
    clinicId: string,
    data: CreateTreatmentPlanInput
  ) {
    const { procedures, paymentTerms, isBudget, ...planData } = data;

    // 1. Verificar se o plano existe e se ainda é um rascunho (DRAFT)
    const existingPlan = await prisma.treatmentPlan.findFirst({
      where: { id, clinicId }, // SEGURANÇA
    });

    if (!existingPlan) throw new Error("Plano de tratamento não encontrado.");

    if (existingPlan.status !== TreatmentPlanStatus.DRAFT) {
      throw new Error(
        "Não é permitido editar uma venda já finalizada. Cancele a venda ou crie uma nova."
      );
    }

    return prisma.$transaction(async (tx) => {
      // 2. Remover procedimentos antigos
      await tx.treatmentPlanProcedure.deleteMany({
        where: { treatmentPlanId: id },
      });

      // 3. Atualizar os dados básicos do Plano e reinserir procedimentos
      const updatedPlan = await tx.treatmentPlan.update({
        where: { id },
        data: {
          ...planData,
          installmentCount: paymentTerms.numberOfInstallments,
          status: isBudget
            ? TreatmentPlanStatus.DRAFT
            : TreatmentPlanStatus.APPROVED,
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

      // 4. Se o usuário resolveu FINALIZAR a venda durante a edição (isBudget = false)
      if (!isBudget) {
        await this.generateFinancials(
          tx,
          updatedPlan.id,
          clinicId,
          Number(updatedPlan.total),
          paymentTerms.numberOfInstallments,
          paymentTerms.firstDueDate
            ? new Date(paymentTerms.firstDueDate)
            : undefined
        );
      }

      return updatedPlan;
    });
  }

  // --- DELETAR COM SEGURANÇA ---
  static async delete(id: string, clinicId: string) {
    const plan = await prisma.treatmentPlan.findFirst({
      where: { id, clinicId }, // SEGURANÇA
      include: {
        paymentInstallments: true,
        commissionRecords: true,
        appointments: true,
      },
    });

    if (!plan) throw new Error("Plano não encontrado.");

    // VERIFICAÇÃO DE SEGURANÇA
    const hasPaidInstallment = plan.paymentInstallments.some(
      (p) => p.status === PaymentStatus.PAID
    );
    const hasPaidCommission = plan.commissionRecords.some(
      (c) => c.status === "PAID"
    );
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

    return prisma.$transaction(async (tx) => {
      await tx.commissionRecord.deleteMany({ where: { treatmentPlanId: id } });
      await tx.paymentInstallment.deleteMany({
        where: { treatmentPlanId: id },
      });
      await tx.treatmentPlanProcedure.deleteMany({
        where: { treatmentPlanId: id },
      });

      await tx.appointment.updateMany({
        where: { treatmentPlanId: id },
        data: { treatmentPlanId: null, treatmentPlanProcedureId: null },
      });

      await tx.treatmentPlan.delete({ where: { id } });
    });
  }

  static async list(clinicId: string) {
    return prisma.treatmentPlan.findMany({
      where: { clinicId }, // SEGURANÇA
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
      where: { id, clinicId }, // SEGURANÇA
      include: {
        patient: true,
        seller: true,
        procedures: {
          include: {
            procedure: true,
          },
        },
        paymentInstallments: {
          orderBy: { installmentNumber: "asc" },
        },
      },
    });
  }
}
