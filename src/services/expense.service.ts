import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus, TransactionType } from "@prisma/client";
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  MarkExpenseAsPaidInput,
} from "../schemas/expense.schema";

export class ExpenseService {
  static async create(data: CreateExpenseInput, clinicId: string) {
    // Opcional: Validar se supplierId e categoryId pertencem à clínica
    if (data.supplierId) {
      await prisma.supplier.findFirstOrThrow({
        where: { id: data.supplierId, clinicId },
      });
    }
    if (data.categoryId) {
      await prisma.expenseCategory.findFirstOrThrow({
        where: { id: data.categoryId, clinicId },
      });
    }

    return prisma.expense.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: PaymentStatus[];
      dueDateStart?: string;
      dueDateEnd?: string;
      categoryId?: string;
      supplierId?: string;
    }
  ) {
    const where: Prisma.ExpenseWhereInput = { clinicId };
    const now = new Date();

    // Lógica de Status similar a PaymentInstallment
    if (filters.status && filters.status.length > 0) {
      const directStatuses = filters.status.filter(
        (s) => s !== PaymentStatus.OVERDUE
      );
      const conditions: Prisma.ExpenseWhereInput[] = [];
      if (directStatuses.length > 0)
        conditions.push({ status: { in: directStatuses } });
      if (filters.status.includes(PaymentStatus.OVERDUE)) {
        conditions.push({
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        });
      }
      where.OR = conditions;
    }

    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = {};
      if (filters.dueDateStart)
        where.dueDate.gte = new Date(filters.dueDateStart);
      if (filters.dueDateEnd) where.dueDate.lte = new Date(filters.dueDateEnd);
    }
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.supplierId) where.supplierId = filters.supplierId;

    const skip = (page - 1) * pageSize;
    const [expenses, totalCount] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { dueDate: "asc" },
      }),
      prisma.expense.count({ where }),
    ]);

    // Adiciona status OVERDUE dinamicamente
    const expensesWithStatus = expenses.map((exp) => ({
      ...exp,
      status:
        exp.status === PaymentStatus.PENDING && exp.dueDate < now
          ? PaymentStatus.OVERDUE
          : exp.status,
    }));

    return { data: expensesWithStatus, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.expense.findFirst({
      where: { id, clinicId },
      include: { category: true, supplier: true },
    });
  }

  static async update(id: string, clinicId: string, data: UpdateExpenseInput) {
    await prisma.expense.findFirstOrThrow({ where: { id, clinicId } });
    // Opcional: Validar supplierId e categoryId se forem alterados
    if (data.supplierId)
      await prisma.supplier.findFirstOrThrow({
        where: { id: data.supplierId, clinicId },
      });
    if (data.categoryId)
      await prisma.expenseCategory.findFirstOrThrow({
        where: { id: data.categoryId, clinicId },
      });

    return prisma.expense.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.expense.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.expense.delete({ where: { id } });
  }

  static async markAsPaid(
    id: string,
    clinicId: string,
    data: MarkExpenseAsPaidInput
  ) {
    return prisma.$transaction(async (tx) => {
      // Envolve em transação
      // 1. Valida e busca a despesa
      const expense = await tx.expense.findFirstOrThrow({
        where: {
          id,
          clinicId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        },
      });

      // --- Validação da Conta Bancária ---
      await tx.bankAccount.findFirstOrThrow({
        where: { id: data.bankAccountId, clinicId: clinicId },
      });
      // ---------------------------------

      // 2. Atualiza o status da despesa
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: PaymentStatus.PAID,
          paymentDate: new Date(data.paymentDate),
        },
      });

      const activeSession = await tx.cashRegisterSession.findFirst({
        where: {
          bankAccountId: data.bankAccountId,
          status: "OPEN",
        },
      });

      // 4. REGRA DE NEGÓCIO: Se o caixa estiver fechado, BLOQUEAR.
      if (!activeSession) {
        const bankAccount = await tx.bankAccount.findUnique({
          where: { id: data.bankAccountId },
          select: { name: true },
        });
        throw new Error(
          `CAIXA FECHADO: Não é possível registrar esta despesa pois o caixa "${
            bankAccount?.name || "desconhecido"
          }" está fechado. Abra o caixa primeiro.`
        );
      }

      // 5. Cria a transação financeira de SAÍDA VINCULADA
      await tx.financialTransaction.create({
        data: {
          clinicId: clinicId,
          description: updatedExpense.description,
          amount: updatedExpense.amount,
          type: TransactionType.EXPENSE,
          date: new Date(data.paymentDate),
          bankAccountId: data.bankAccountId,
          expenseId: updatedExpense.id,
          // Vincula obrigatoriamente à sessão ativa
          cashRegisterSessionId: activeSession.id,
        },
      });

      // 6. Atualiza o saldo da BankAccount (DECREMENTAR)
      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { balance: { decrement: updatedExpense.amount } },
      });
      console.log(
        `Saldo da conta ${data.bankAccountId} decrementado em ${updatedExpense.amount}.`
      );

      return updatedExpense; // Retorna a despesa atualizada
    });
  }
}
