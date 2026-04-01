import { FastifyInstance } from "fastify";
import { z } from "zod";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";

export async function subscriptionRoutes(app: FastifyInstance) {
  app.post("/checkout", async (request, reply) => {
    const checkoutSchema = z.object({
      accountId: z.string().uuid(),
      priceId: z.string().optional(),
      skipTrial: z.boolean().default(false),
      addons: z
        .array(
          z.object({
            priceId: z.string(),
            quantity: z.number().min(1).default(1),
          })
        )
        .optional(),
    });

    const { accountId, priceId, addons, skipTrial } = checkoutSchema.parse(
      request.body
    );

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { owner: true },
    });

    const lineItems = [];

    if (priceId && priceId.trim() !== "") {
      lineItems.push({
        price: priceId,
        quantity: 1,
      });
    }

    if (addons && addons.length > 0) {
      addons.forEach((addon) => {
        lineItems.push({
          price: addon.priceId,
          quantity: addon.quantity,
        });
      });
    }

    if (lineItems.length === 0) {
      return reply.status(400).send({
        message: "Selecione pelo menos um plano ou item para continuar.",
      });
    }

    let customerId = account.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: account.owner.email,
        name: account.owner.fullName,
        metadata: { accountId: account.id },
      });
      customerId = customer.id;
      await prisma.account.update({
        where: { id: accountId },
        data: { stripeCustomerId: customerId },
      });
    }

    const subscriptionData: any = {
      metadata: { accountId: accountId },
    };

    if (!skipTrial) {
      subscriptionData.trial_period_days = 3;
    }

    const frontendUrl = process.env.FRONTEND_URL;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_collection: "always",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${frontendUrl}/main?success=true`,
      cancel_url: `${frontendUrl}/main?canceled=true`,
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
    });

    return { sessionId: session.id, url: session.url };
  });

  // Rota do Portal do Cliente BLINDADA
  app.post("/portal", async (request, reply) => {
    try {
      const { accountId } = z
        .object({ accountId: z.string().uuid() })
        .parse(request.body);

      const account = await prisma.account.findUniqueOrThrow({
        where: { id: accountId },
      });

      // Se não tem ID no Stripe, devolvemos erro 400 amigável em vez de quebrar a API
      if (!account.stripeCustomerId) {
        return reply.status(400).send({
          message:
            "Esta conta ainda não possui vínculo financeiro com o Stripe.",
        });
      }

      // Fallback salvador: se a variável de ambiente falhar, ele usa o localhost
      const frontendUrl = process.env.FRONTEND_URL;

      const session = await stripe.billingPortal.sessions.create({
        customer: account.stripeCustomerId,
        return_url: `${frontendUrl}/main/settings/account`,
      });

      return { url: session.url };
    } catch (error: any) {
      console.error("[STRIPE PORTAL ERROR]:", error);
      return reply.status(500).send({
        message: "Erro ao gerar link do portal do Stripe.",
        details: error.message,
      });
    }
  });
}
