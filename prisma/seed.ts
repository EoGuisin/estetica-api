// prisma/seed.ts ATUALIZADO PARA LÓGICA CORRETA
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const STORAGE_10GB = BigInt(10) * BigInt(1024) * BigInt(1024) * BigInt(1024);

  // --- CONFIGURAÇÃO DOS IDS DO STRIPE ---
  // Vá no Stripe > Catálogo. Crie o Produto "Plano Essencial".
  // Dentro dele, adicione o preço Mensal e o preço Anual.
  const STRIPE_PROD_ESSENCIAL = "prod_Tmta0Ivq0JuL3B";
  const STRIPE_PRICE_ESSENCIAL_MENSAL = "price_1SpJnQ98FBliezJxOCLkHyqt";
  const STRIPE_PRICE_ESSENCIAL_ANUAL = "price_1SpMGb98FBliezJx6kFf13E9";

  // Crie o Produto "Plano Experts" com seus dois preços.
  const STRIPE_PROD_EXPERTS = "prod_TmtnXmlqdFR6D8";
  const STRIPE_PRICE_EXPERTS_MENSAL = "price_1SpJzv98FBliezJxT7Tndnl0";
  const STRIPE_PRICE_EXPERTS_ANUAL = "price_1SpMHH98FBliezJx2qEilGfa";
  // --------------------------------------

  console.log("Criando planos no banco...");

  // 1. Essencial Mensal
  await prisma.subscriptionPlan.upsert({
    where: { name: "Essencial Mensal" },
    update: {
      stripeProductId: STRIPE_PROD_ESSENCIAL,
      stripePriceId: STRIPE_PRICE_ESSENCIAL_MENSAL,
    },
    create: {
      name: "Essencial Mensal",
      price: 249.0,
      maxUsers: 5,
      maxStorage: STORAGE_10GB,
      hasCrm: false,
      hasAi: false,
      hasApp: false,
      hasFunnel: false,
      hasWhats: false,
      stripeProductId: STRIPE_PROD_ESSENCIAL,
      stripePriceId: STRIPE_PRICE_ESSENCIAL_MENSAL,
    },
  });

  // 2. Essencial Anual (No banco é outro registro, mas no Stripe é o MESMO PRODUTO)
  await prisma.subscriptionPlan.upsert({
    where: { name: "Essencial Anual" },
    update: {
      stripeProductId: STRIPE_PROD_ESSENCIAL,
      stripePriceId: STRIPE_PRICE_ESSENCIAL_ANUAL,
    },
    create: {
      name: "Essencial Anual",
      price: 2496.0,
      maxUsers: 5,
      maxStorage: STORAGE_10GB,
      hasCrm: false,
      hasAi: false,
      hasApp: false,
      hasFunnel: false,
      hasWhats: false,
      stripeProductId: STRIPE_PROD_ESSENCIAL,
      stripePriceId: STRIPE_PRICE_ESSENCIAL_ANUAL,
    },
  });

  // 3. Experts Mensal
  await prisma.subscriptionPlan.upsert({
    where: { name: "Experts Mensal" },
    update: {
      stripeProductId: STRIPE_PROD_EXPERTS,
      stripePriceId: STRIPE_PRICE_EXPERTS_MENSAL,
    },
    create: {
      name: "Experts Mensal",
      price: 499.0,
      maxUsers: 20,
      maxStorage: STORAGE_10GB,
      hasCrm: true,
      hasAi: true,
      hasApp: true,
      hasFunnel: true,
      hasWhats: true,
      stripeProductId: STRIPE_PROD_EXPERTS,
      stripePriceId: STRIPE_PRICE_EXPERTS_MENSAL,
    },
  });

  // 4. Experts Anual
  await prisma.subscriptionPlan.upsert({
    where: { name: "Experts Anual" },
    update: {
      stripeProductId: STRIPE_PROD_EXPERTS,
      stripePriceId: STRIPE_PRICE_EXPERTS_ANUAL,
    },
    create: {
      name: "Experts Anual",
      price: 4788.0,
      maxUsers: 20,
      maxStorage: STORAGE_10GB,
      hasCrm: true,
      hasAi: true,
      hasApp: true,
      hasFunnel: true,
      hasWhats: true,
      stripeProductId: STRIPE_PROD_EXPERTS,
      stripePriceId: STRIPE_PRICE_EXPERTS_ANUAL,
    },
  });

  console.log("Planos configurados corretamente!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
