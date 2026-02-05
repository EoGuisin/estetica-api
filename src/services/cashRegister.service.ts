import { prisma } from "../lib/prisma";
import { CashRegisterSessionStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class CashRegisterService {
  /**
   * Abre uma nova sessão de caixa para uma conta bancária.
   */
  static async openSession(
    clinicId: string,
    userId: string,
    bankAccountId: string,
    observedOpening: number
  ) {
    // 1. Verifica se já existe uma sessão aberta para esta conta NA CLÍNICA ATUAL
    const existingOpenSession = await prisma.cashRegisterSession.findFirst({
      where: { bankAccountId, status: "OPEN", clinicId },
    });
    if (existingOpenSession) {
      throw new Error("Já existe uma sessão de caixa aberta para esta conta.");
    }

    // 2. Busca o saldo atual real da conta no banco de dados
    // SEGURANÇA: Garante que a conta pertence à clínica
    const bankAccount = await prisma.bankAccount.findFirstOrThrow({
      where: { id: bankAccountId, clinicId },
    });

    // 3. Cria a nova sessão
    const newSession = await prisma.cashRegisterSession.create({
      data: {
        clinicId,
        bankAccountId,
        openedByUserId: userId,
        openingBalance: bankAccount.balance, // Saldo real do sistema
        observedOpening: new Decimal(observedOpening.toFixed(2)), // Saldo contado pelo usuário
        status: CashRegisterSessionStatus.OPEN,
      },
      include: {
        bankAccount: { select: { id: true, name: true } },
        openedByUser: { select: { fullName: true } },
      },
    });

    return newSession;
  }

  /**
   * Fecha uma sessão de caixa aberta.
   */
  static async closeSession(
    clinicId: string,
    userId: string,
    sessionId: string,
    observedClosing: number,
    notes: string | null | undefined
  ) {
    // 1. Encontra a sessão que deve ser fechada
    // SEGURANÇA: Garante que a sessão pertence à clínica
    const session = await prisma.cashRegisterSession.findFirstOrThrow({
      where: { id: sessionId, clinicId, status: "OPEN" },
    });

    // 2. Busca o saldo atualizado da conta
    // SEGURANÇA: Garante que a conta pertence à clínica (redundante mas bom)
    const bankAccount = await prisma.bankAccount.findFirstOrThrow({
      where: { id: session.bankAccountId, clinicId },
    });

    const closingBalance = bankAccount.balance;
    const observedClosingDecimal = new Decimal(observedClosing.toFixed(2));
    const discrepancy = observedClosingDecimal.sub(closingBalance);

    // 3. Atualiza (fecha) a sessão
    const closedSession = await prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        status: CashRegisterSessionStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: userId,
        closingBalance: closingBalance,
        observedClosing: observedClosingDecimal,
        discrepancy: discrepancy,
        notes: notes,
      },
    });

    return closedSession;
  }

  /**
   * Busca a sessão de caixa ativa (aberta) para uma determinada conta.
   */
  static async getActiveSession(clinicId: string, bankAccountId: string) {
    const session = await prisma.cashRegisterSession.findFirst({
      where: { clinicId, bankAccountId, status: "OPEN" },
      include: {
        bankAccount: { select: { id: true, name: true, balance: true } },
        openedByUser: { select: { fullName: true } },
      },
    });

    if (!session) {
      // Se não houver sessão aberta, retorna o status da conta para o front-end
      // SEGURANÇA: Só retorna se a conta for desta clínica
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: bankAccountId, clinicId },
        select: { id: true, name: true, balance: true },
      });
      return { session: null, bankAccount };
    }

    return { session, bankAccount: session.bankAccount };
  }

  /**
   * Busca os detalhes de uma sessão (aberta ou fechada),
   * incluindo todas as transações financeiras vinculadas.
   */
  static async getSessionDetails(clinicId: string, sessionId: string) {
    // SECURITY: Ensure the session belongs to the clinic
    const session = await prisma.cashRegisterSession.findFirstOrThrow({
      where: { id: sessionId, clinicId },
      include: {
        bankAccount: { select: { name: true } },
        openedByUser: { select: { fullName: true } },
        closedByUser: { select: { fullName: true } },
        // --- CRITICAL FIX: INCLUDE TRANSACTIONS ---
        transactions: {
          orderBy: { date: "asc" },
          include: {
            // Include installment data to know the PAYMENT METHOD
            paymentInstallment: {
              select: {
                installmentNumber: true,
                paymentMethod: true, // Required for method breakdown
                treatmentPlan: {
                  select: { patient: { select: { name: true } } },
                },
              },
            },
            expense: {
              select: {
                description: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    // Calculate totals on the backend for consistency
    const totals = session.transactions.reduce(
      (acc, tx) => {
        if (tx.type === "REVENUE") {
          acc.totalRevenue = acc.totalRevenue.add(tx.amount);
        } else if (tx.type === "EXPENSE") {
          acc.totalExpense = acc.totalExpense.add(tx.amount);
        }
        return acc;
      },
      {
        totalRevenue: new Decimal(0),
        totalExpense: new Decimal(0),
      }
    );

    return { ...session, ...totals };
  }

  /**
   * Lista todas as sessões (abertas ou fechadas) com filtros.
   */
  static async listSessions(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: CashRegisterSessionStatus;
      dateStart?: string;
      dateEnd?: string;
      bankAccountId?: string;
    }
  ) {
    const where: Prisma.CashRegisterSessionWhereInput = { clinicId }; // TRAVA DE SEGURANÇA

    if (filters.status) where.status = filters.status;
    if (filters.bankAccountId) where.bankAccountId = filters.bankAccountId;
    if (filters.dateStart || filters.dateEnd) {
      where.openedAt = {};
      if (filters.dateStart) where.openedAt.gte = new Date(filters.dateStart);
      if (filters.dateEnd) where.openedAt.lte = new Date(filters.dateEnd);
    }

    const skip = (page - 1) * pageSize;
    const [sessions, totalCount] = await prisma.$transaction([
      prisma.cashRegisterSession.findMany({
        where,
        include: {
          bankAccount: { select: { name: true } },
          openedByUser: { select: { fullName: true } },
          closedByUser: { select: { fullName: true } },
          _count: { select: { transactions: true } },
        },
        skip,
        take: pageSize,
        orderBy: { openedAt: "desc" },
      }),
      prisma.cashRegisterSession.count({ where }),
    ]);

    return { data: sessions, totalCount };
  }
}
