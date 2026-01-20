//src/middleware/subscriptionGuard.ts
import { prisma } from "../lib/prisma";

export class SubscriptionGuard {
  // Verifica se a clínica tem acesso a uma feature específica
  static async checkFeature(
    clinicId: string,
    feature:
      | "activeCrm"
      | "activeAi"
      | "activeApp"
      | "activeFunnel"
      | "activeWhats"
  ) {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        account: {
          select: {
            subscription: {
              select: {
                status: true,
                [feature]: true, // Seleciona dinamicamente a coluna (activeAi, activeCrm, etc)
              },
            },
          },
        },
      },
    });

    const sub = clinic.account?.subscription;

    if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
      throw new Error(
        "Assinatura inativa ou expirada. Regularize seu pagamento."
      );
    }

    const hasAccess = sub[feature];

    if (!hasAccess) {
      throw new Error(
        `Seu plano atual não inclui acesso a: ${feature
          .replace("active", "")
          .toUpperCase()}. Faça um upgrade.`
      );
    }

    return true;
  }
}
