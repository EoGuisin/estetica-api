// src/services/treatmentPlan.service.ts
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CreateTreatmentPlanInput } from "../schemas/treatmentPlan.schema";

export class TreatmentPlanService {
  /**
   * Cria um novo Plano de Tratamento e suas parcelas associadas.
   */
  static async create(clinicId: string, data: CreateTreatmentPlanInput) {
    // <-- Usa o tipo importado
    // Separa os dados do plano, procedimentos e termos de pagamento
    const { procedures, paymentTerms, ...planData } = data;

    if (!procedures || procedures.length === 0) {
      throw new Error("Pelo menos um procedimento é necessário.");
    }
    if (!paymentTerms || paymentTerms.numberOfInstallments < 1) {
      throw new Error("Termos de pagamento inválidos.");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Cria o Plano de Tratamento
      const newPlan = await tx.treatmentPlan.create({
        data: {
          ...planData,
          clinicId,
          procedures: {
            create: procedures.map((proc) => ({
              procedureId: proc.procedureId,
              contractedSessions: proc.contractedSessions, // Já são números pelo Zod coerce
              unitPrice: proc.unitPrice, // Já é número pelo Zod coerce
              followUps: proc.followUps,
            })),
          },
        },
      });

      // --- LÓGICA COMPLETA DE CRIAÇÃO DE PARCELAS ---
      const totalAmount = newPlan.total;
      const numberOfInstallments = paymentTerms.numberOfInstallments;
      const installmentAmount = Number.parseFloat(
        (Number(totalAmount) / numberOfInstallments).toFixed(2)
      );

      // Calcula o valor da última parcela para ajustar arredondamentos
      const lastInstallmentAmount =
        Number(totalAmount) - installmentAmount * (numberOfInstallments - 1);

      const installmentsData = [];
      let currentDueDate = paymentTerms.firstDueDate
        ? new Date(paymentTerms.firstDueDate)
        : new Date();
      if (!paymentTerms.firstDueDate) {
        currentDueDate.setDate(currentDueDate.getDate() + 30); // Padrão D+30 se não informado
      }

      for (let i = 1; i <= numberOfInstallments; i++) {
        installmentsData.push({
          treatmentPlanId: newPlan.id,
          clinicId: clinicId,
          installmentNumber: i,
          dueDate: new Date(currentDueDate), // Cria uma nova instância da data
          amountDue:
            i === numberOfInstallments
              ? lastInstallmentAmount
              : installmentAmount, // Usa valor ajustado na última
          status: PaymentStatus.PENDING,
        });

        // Adiciona 1 mês para a próxima parcela (cuidado com virada de ano/mês)
        currentDueDate.setMonth(currentDueDate.getMonth() + 1);
      }

      // Cria todas as parcelas de uma vez
      await tx.paymentInstallment.createMany({
        data: installmentsData,
      });
      // --- FIM DA LÓGICA DE PARCELAS ---

      // Retorna o plano completo com as parcelas
      return tx.treatmentPlan.findUnique({
        where: { id: newPlan.id },
        include: {
          procedures: { include: { procedure: true } },
          patient: true,
          seller: true,
          paymentInstallments: { orderBy: { installmentNumber: "asc" } }, // Ordena as parcelas
        },
      });
    });
  }

  static async list(clinicId: string) {
    // A listagem pode incluir a contagem de parcelas totais e pagas, se útil
    return prisma.treatmentPlan.findMany({
      where: { clinicId },
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        _count: {
          select: {
            procedures: true,
            paymentInstallments: true, // Total de parcelas
          },
        },
        paymentInstallments: {
          // Para calcular quantas foram pagas
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
