import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const STORAGE_100GB =
    BigInt(100) * BigInt(1024) * BigInt(1024) * BigInt(1024);
  const EXPIRATION_DATE = new Date("2200-01-01T00:00:00Z");

  // IDs das suas contas existentes (conforme seu JSON)
  const TARGET_ACCOUNTS = [
    "1f4b837a-c051-43a0-b8a9-7bd432f97104",
    "237d0e65-d920-4441-acdd-95fcff500575",
  ];

  // ID do Plano Experts Anual (conforme seu JSON de subscribe-plans)
  const EXPERTS_PLAN_ID = "9a385fb6-9b27-4bbf-b9ba-5aa65ec4f06f";

  console.log("🚀 Iniciando migração das contas master...");

  for (const accountId of TARGET_ACCOUNTS) {
    console.log(`Configurando conta: ${accountId}`);

    await prisma.subscription.upsert({
      where: { accountId: accountId },
      update: {
        planId: EXPERTS_PLAN_ID,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: EXPIRATION_DATE,
        currentMaxUsers: 999, // Liberdade total de usuários
        currentMaxStorage: STORAGE_100GB, // 100GB de espaço
        // Ativando absolutamente todas as features
        activeCrm: true,
        activeAi: true,
        activeApp: true,
        activeFunnel: true,
        activeWhats: true,
      },
      create: {
        accountId: accountId,
        planId: EXPERTS_PLAN_ID,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: EXPIRATION_DATE,
        currentMaxUsers: 999,
        currentMaxStorage: STORAGE_100GB,
        activeCrm: true,
        activeAi: true,
        activeApp: true,
        activeFunnel: true,
        activeWhats: true,
      },
    });

    console.log(
      `✅ Conta ${accountId} atualizada com sucesso (Válida até 2200).`
    );
  }

  console.log("\n✨ Processo finalizado. Suas contas agora são 'VIPS'.");
}

main()
  .catch((e) => {
    console.error("❌ Erro ao rodar o seed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
