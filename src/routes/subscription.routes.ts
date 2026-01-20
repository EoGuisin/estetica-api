//src/routes/subscription.routes.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";

export async function subscriptionRoutes(app: FastifyInstance) {
  app.post("/checkout", async (request, reply) => {
    const checkoutSchema = z.object({
      accountId: z.string().uuid(),
      priceId: z.string().optional(), // Agora é opcional (pode ser só add-on ou vir vazio)
      skipTrial: z.boolean().default(false), // NOVO: Opção para pular o teste
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

    // 1. Monta os itens do carrinho de forma segura
    const lineItems = [];

    // Se tiver um Plano Base (PriceId não vazio), adiciona
    if (priceId && priceId.trim() !== "") {
      lineItems.push({
        price: priceId,
        quantity: 1,
      });
    }

    // Se tiver Add-ons, adiciona
    if (addons && addons.length > 0) {
      addons.forEach((addon) => {
        lineItems.push({
          price: addon.priceId,
          quantity: addon.quantity,
        });
      });
    }

    if (lineItems.length === 0) {
      throw new Error("Selecione pelo menos um plano ou item para continuar.");
    }

    // 2. Cria ou recupera Customer
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

    // 3. Configurações da Assinatura (Trial ou Não)
    const subscriptionData: any = {
      metadata: { accountId: accountId },
    };

    // Só adiciona trial se o usuário NÃO pediu para pular
    if (!skipTrial) {
      subscriptionData.trial_period_days = 3;
    }

    // 4. Cria a Sessão
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_collection: "always",
      payment_method_types: ["card"],
      line_items: lineItems,
      // Sucesso: Vai para o dashboard
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
      // Cancelamento: Volta para o dashboard (onde ele verá que está inativo)
      // Isso evita erro 404 se /settings/billing não for acessível
      cancel_url: `${process.env.FRONTEND_URL}/dashboard?canceled=true`,

      subscription_data: subscriptionData,
      allow_promotion_codes: true,
    });

    return { sessionId: session.id, url: session.url };
  });

  // Rota para gerar link do Portal do Cliente (Trocar cartão, cancelar, ver faturas)
  app.post("/portal", async (request, reply) => {
    const { accountId } = z
      .object({ accountId: z.string().uuid() })
      .parse(request.body);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
    });

    if (!account.stripeCustomerId) {
      throw new Error("Conta ainda não possui vínculo financeiro.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/admin/settings/billing`,
    });

    return { url: session.url };
  });
}
