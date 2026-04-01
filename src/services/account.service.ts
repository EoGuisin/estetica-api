import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { CreateClinicInput } from "../schemas/account.schema";

export class AccountService {
  static async getStats(accountId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { accountId },
      select: { currentMaxUsers: true },
    });

    const currentUsers = await prisma.user.count({
      where: {
        clinics: { some: { accountId: accountId } },
      },
    });

    return {
      maxUsers: subscription?.currentMaxUsers || 0,
      currentUsers,
    };
  }

  static async listClinics(accountId: string) {
    return prisma.clinic.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
  }

  static async getSubscription(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });
    return account?.subscription || null;
  }

  static async createClinic(accountId: string, data: CreateClinicInput) {
    const existingClinic = await prisma.clinic.findUnique({
      where: { taxId: data.taxId },
    });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        _count: { select: { clinics: true } },
        subscription: { include: { plan: true } },
      },
    });

    if (!account) throw new Error("Conta não encontrada.");
    if (!account.subscription || !account.subscription.plan) {
      throw {
        code: "PAYMENT_REQUIRED",
        message: "Nenhum plano de assinatura ativo.",
      };
    }

    return prisma.clinic.create({
      data: {
        ...data,
        accountId: accountId,
        status: "ACTIVE",
      },
    });
  }

  static async listUserClinics(userId: string, accountId: string) {
    return prisma.clinic.findMany({
      where: {
        accountId: accountId,
        OR: [
          { account: { ownerId: userId } },
          { users: { some: { id: userId } } },
        ],
      },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    });
  }

  // --- NOVA FUNÇÃO DE CANCELAMENTO ---
  static async cancelSubscription(
    accountId: string,
    reason: string,
    description?: string
  ) {
    const sub = await prisma.subscription.findUnique({
      where: { accountId },
    });

    if (!sub || !sub.stripeSubscriptionId) {
      throw { code: "NOT_FOUND", message: "Assinatura ativa não encontrada." };
    }

    // 1. Salva o feedback no banco
    await prisma.cancelationFeedback.create({
      data: { accountId, reason, description },
    });

    // 2. Comanda o Stripe para cancelar no fim do período
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    // 3. Atualiza o banco na hora para a tela do usuário mudar instantaneamente
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAtPeriodEnd: true },
    });

    return { message: "Assinatura agendada para cancelamento com sucesso." };
  }
}
