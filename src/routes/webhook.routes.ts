//src/routes/webhook.routes.ts
import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";

const GB_TO_BYTES = BigInt(1073741824);

export async function webhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      done(null, body);
    }
  );

  app.post("/webhooks/stripe", async (request, reply) => {
    const signature = request.headers["stripe-signature"] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return reply.status(400).send(`Webhook Error: ${err.message}`);
    }

    const relevantEvents = new Set([
      "checkout.session.completed",
      "invoice.payment_succeeded",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]);

    if (relevantEvents.has(event.type)) {
      const session = event.data.object as any;
      const subscriptionId = session.subscription || session.id;

      // CORREÇÃO AQUI: Usamos 'as any' porque sua definição de tipos removeu
      // current_period_start/end, mas precisamos acessar esses valores se eles existirem no JSON
      // ou usar fallbacks.
      const stripeSubscription = (await stripe.subscriptions.retrieve(
        subscriptionId,
        {
          expand: ["items.data.price.product"],
        }
      )) as any;

      const customerId = stripeSubscription.customer as string;

      const account = await prisma.account.findUnique({
        where: { stripeCustomerId: customerId },
      });

      if (!account) {
        return reply.status(200).send();
      }

      // --- CÁLCULO DE LIMITES ---
      let totalUsers = 0;
      let totalStorage = BigInt(0);

      let hasCrm = false;
      let hasAi = false;
      let hasApp = false;
      let hasFunnel = false;
      let hasWhats = false;

      let planName = "Customizado";
      let planIdDb = "";

      const subStatus = stripeSubscription.status;

      // Tratamento seguro para as datas, caso a API nova não as envie
      const now = Math.floor(Date.now() / 1000);

      // Se não tiver start, usa o billing_cycle_anchor ou 'agora'
      const periodStart =
        stripeSubscription.current_period_start ||
        stripeSubscription.billing_cycle_anchor ||
        now;

      // Se não tiver end, usa o start + 30 dias (aprox) como fallback
      const periodEnd =
        stripeSubscription.current_period_end ||
        periodStart + 30 * 24 * 60 * 60;

      // Iteração sobre os itens (tipagem mantida como any para evitar conflito com a definição customizada)
      if (stripeSubscription.items && stripeSubscription.items.data) {
        for (const item of stripeSubscription.items.data) {
          const product = item.price.product as any; // any para acessar metadata sem travar
          const quantity = item.quantity || 1;
          const metadata = product.metadata || {};

          // 1. Planos Base
          if (metadata.plan_type === "ESSENTIAL") {
            planName = "Essencial";
            totalUsers += 5;
            totalStorage += BigInt(10) * GB_TO_BYTES;
            const p = await prisma.subscriptionPlan.findUnique({
              where: { name: "Essencial Mensal" },
            });
            if (p) planIdDb = p.id;
          } else if (metadata.plan_type === "EXPERTS") {
            planName = "Experts";
            totalUsers += 20;
            totalStorage += BigInt(10) * GB_TO_BYTES;
            hasCrm = true;
            hasAi = true;
            hasApp = true;
            hasFunnel = true;
            hasWhats = true;
            const p = await prisma.subscriptionPlan.findUnique({
              where: { name: "Experts Mensal" },
            });
            if (p) planIdDb = p.id;
          }

          // 2. Add-ons
          if (metadata.feature_user) {
            totalUsers += parseInt(metadata.feature_user) * quantity;
          }
          if (metadata.feature_crm === "true") hasCrm = true;
          if (metadata.feature_whats === "true") hasWhats = true;
          if (metadata.feature_ai === "true") hasAi = true;
          if (metadata.feature_app === "true") hasApp = true;
          if (metadata.feature_funnel === "true") hasFunnel = true;
        }
      }

      if (!planIdDb) {
        const defaultPlan = await prisma.subscriptionPlan.findFirst();
        planIdDb = defaultPlan?.id || "";
      }

      const trialEnd = stripeSubscription.trial_end;
      const currentPeriodEnd = stripeSubscription.current_period_end;

      // LÓGICA CORRIGIDA:
      // Se tiver trial_end, o acesso vai até lá. Se não, vai até o fim do ciclo pago.
      const accessUntil = trialEnd
        ? new Date(trialEnd * 1000)
        : new Date(currentPeriodEnd * 1000);

      const periodStartData = new Date(periodStart * 1000);

      // ATUALIZA O BANCO
      await prisma.subscription.upsert({
        where: { accountId: account.id },
        create: {
          accountId: account.id,
          planId: planIdDb,
          stripeSubscriptionId: stripeSubscription.id,
          status: subStatus,
          currentPeriodStart: periodStartData,
          currentPeriodEnd: accessUntil, // <--- AQUI ESTAVA O ERRO, AGORA USA accessUntil
          currentMaxUsers: totalUsers,
          currentMaxStorage: totalStorage,
          activeCrm: hasCrm,
          activeAi: hasAi,
          activeApp: hasApp,
          activeFunnel: hasFunnel,
          activeWhats: hasWhats,
        },
        update: {
          status: subStatus,
          planId: planIdDb,
          currentPeriodStart: periodStartData,
          currentPeriodEnd: accessUntil, // <--- AQUI TAMBÉM
          currentMaxUsers: totalUsers,
          currentMaxStorage: totalStorage,
          activeCrm: hasCrm,
          activeAi: hasAi,
          activeApp: hasApp,
          activeFunnel: hasFunnel,
          activeWhats: hasWhats,
        },
      });

      console.log(
        `Webhook: Assinatura processada para conta ${account.id}. Users: ${totalUsers}`
      );
    }

    return reply.send({ received: true });
  });
}
