import { prisma } from "../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-12-15.clover",
});

export class AdminReportsService {
  static async getDashboardMetrics(startDate?: Date, endDate?: Date) {
    const dateFilter =
      startDate && endDate ? { gte: startDate, lte: endDate } : undefined;

    const unixStart = startDate
      ? Math.floor(startDate.getTime() / 1000)
      : undefined;
    const unixEnd = endDate ? Math.floor(endDate.getTime() / 1000) : undefined;

    const [active, canceled, trial, newUsers] = await Promise.all([
      prisma.subscription.count({
        where: { status: "active", createdAt: dateFilter },
      }),
      prisma.subscription.count({
        where: { status: "canceled", updatedAt: dateFilter },
      }),
      prisma.subscription.count({
        where: { status: "trialing", createdAt: dateFilter },
      }),
      prisma.account.count({ where: { createdAt: dateFilter } }),
    ]);

    let grossRevenue = 0;
    let netRevenue = 0;

    try {
      const transactions = await stripe.balanceTransactions
        .list({
          created: { gte: unixStart, lte: unixEnd },
          type: "charge",
        })
        .autoPagingToArray({ limit: 5000 });

      transactions.forEach((txn) => {
        grossRevenue += txn.amount / 100;
        netRevenue += txn.net / 100;
      });
    } catch (e) {
      console.error("[STRIPE ERROR] Erro ao buscar fluxo de caixa:", e);
    }

    return { active, canceled, trial, newUsers, grossRevenue, netRevenue };
  }

  static async getConversionRate(startDate?: Date, endDate?: Date) {
    const unixStart = startDate
      ? Math.floor(startDate.getTime() / 1000)
      : undefined;
    const unixEnd = endDate ? Math.floor(endDate.getTime() / 1000) : undefined;

    try {
    //   console.log(
    //     `[STRIPE LOG] Buscando assinaturas (Conversão) entre: ${unixStart} e ${unixEnd}`
    //   );

      const subs = await stripe.subscriptions
        .list({
          created: { gte: unixStart, lte: unixEnd },
          status: "all",
        })
        .autoPagingToArray({ limit: 5000 });

    //   console.log(
    //     `[STRIPE LOG] Total de assinaturas no período: ${subs.length}`
    //   );

      const withTrial = subs.filter((s) => s.trial_end !== null);
    //   console.log(
    //     `[STRIPE LOG] Dessas, quantas tiveram trial_end configurado: ${withTrial.length}`
    //   );

      const converted = withTrial.filter((s) => s.status === "active").length;
    //   console.log(`[STRIPE LOG] Quantas estão ativas hoje: ${converted}`);

      return {
        rate: withTrial.length > 0 ? (converted / withTrial.length) * 100 : 0,
        total: withTrial.length,
        converted,
      };
    } catch (e) {
      console.error("[STRIPE ERROR] Erro ao buscar conversão:", e);
      return { rate: 0, total: 0, converted: 0 };
    }
  }

  static async getCancelationReasons(startDate?: Date, endDate?: Date) {
    const dateFilter =
      startDate && endDate ? { gte: startDate, lte: endDate } : undefined;
    return prisma.cancelationFeedback.groupBy({
      by: ["reason"],
      _count: { reason: true },
      where: { createdAt: dateFilter },
      orderBy: { _count: { reason: "desc" } },
    });
  }
}
