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
      "customer.subscription.created",
    ]);

    if (relevantEvents.has(event.type)) {
      const session = event.data.object as any;
      const subscriptionId = session.subscription || session.id;
      let customerId = session.customer;

      if (!customerId && subscriptionId) {
        try {
          if (
            typeof subscriptionId === "string" &&
            subscriptionId.startsWith("sub_")
          ) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            customerId = sub.customer;
          }
        } catch (e) {
          console.error("Erro ao buscar customer na subscription", e);
        }
      }

      if (!customerId) return reply.status(200).send();

      const account = await prisma.account.findUnique({
        where: { stripeCustomerId: customerId as string },
      });

      if (!account) {
        console.log(
          `⚠️ Ignorando evento de teste. Conta não encontrada: ${customerId}`
        );
        return reply.status(200).send();
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId as string,
        status: "all",
      });

      let totalUsers = 0;
      let totalStorage = BigInt(0);
      let hasCrm = false;
      let hasAi = false;
      let hasApp = false;
      let hasFunnel = false;
      let hasWhats = false;
      let mainStatus = "canceled";
      let maxPeriodEnd = 0;
      let planIdDb = "";

      // NOVA VARIÁVEL AQUI
      let willCancelAtPeriodEnd = false;

      for (const sub of subscriptions.data) {
        if (
          sub.status !== "active" &&
          sub.status !== "trialing" &&
          sub.status !== "past_due"
        )
          continue;

        if (sub.status === "active" || sub.status === "trialing") {
          mainStatus = sub.status;
          // Se qualquer assinatura ativa do cliente estiver agendada para cancelar, ativamos a flag
          if (sub.cancel_at_period_end) willCancelAtPeriodEnd = true;
        }

        const subAny = sub as any;
        const currentEnd = subAny.trial_end || subAny.current_period_end;
        if (currentEnd > maxPeriodEnd) maxPeriodEnd = currentEnd;

        for (const item of sub.items.data) {
          const productOrId = item.price.product;
          const quantity = item.quantity || 1;
          let product: Stripe.Product;

          try {
            if (typeof productOrId === "string")
              product = await stripe.products.retrieve(productOrId);
            else product = productOrId as Stripe.Product;
          } catch (err) {
            continue;
          }

          const metadata = product.metadata || {};

          if (metadata.plan_type === "ESSENTIAL") {
            totalUsers += 10;
            totalStorage += BigInt(10) * GB_TO_BYTES;
            if (!planIdDb) {
              const p = await prisma.subscriptionPlan.findUnique({
                where: { name: "Essencial Mensal" },
              });
              if (p) planIdDb = p.id;
            }
          } else if (metadata.plan_type === "EXPERTS") {
            totalUsers += 20;
            totalStorage += BigInt(10) * GB_TO_BYTES;
            hasCrm = true;
            hasAi = true;
            hasApp = true;
            hasFunnel = true;
            hasWhats = true;
            if (!planIdDb) {
              const p = await prisma.subscriptionPlan.findUnique({
                where: { name: "Experts Mensal" },
              });
              if (p) planIdDb = p.id;
            }
          }

          if (metadata.feature_user)
            totalUsers += parseInt(metadata.feature_user) * quantity;
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

      const finalPeriodEnd =
        maxPeriodEnd > 0 ? new Date(maxPeriodEnd * 1000) : new Date();

      await prisma.subscription.upsert({
        where: { accountId: account.id },
        create: {
          accountId: account.id,
          planId: planIdDb,
          stripeSubscriptionId: subscriptionId as string,
          status: mainStatus,
          cancelAtPeriodEnd: willCancelAtPeriodEnd,
          currentPeriodStart: new Date(),
          currentPeriodEnd: finalPeriodEnd,
          currentMaxUsers: totalUsers,
          currentMaxStorage: totalStorage,
          activeCrm: hasCrm,
          activeAi: hasAi,
          activeApp: hasApp,
          activeFunnel: hasFunnel,
          activeWhats: hasWhats,
        },
        update: {
          status: mainStatus,
          planId: planIdDb,
          cancelAtPeriodEnd: willCancelAtPeriodEnd,
          currentPeriodEnd: finalPeriodEnd,
          currentMaxUsers: totalUsers,
          currentMaxStorage: totalStorage,
          activeCrm: hasCrm,
          activeAi: hasAi,
          activeApp: hasApp,
          activeFunnel: hasFunnel,
          activeWhats: hasWhats,
        },
      });
    }

    return reply.send({ received: true });
  });
}
