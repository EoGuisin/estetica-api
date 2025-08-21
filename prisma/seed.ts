// prisma/seed.ts
import { PrismaClient, ClinicStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando o script de seed...");

  // Pegar credenciais do .env
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    throw new Error(
      "As variáveis de ambiente SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD são obrigatórias."
    );
  }

  // Criptografar a senha
  const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

  // Usar uma transação para garantir que tudo seja criado com sucesso
  await prisma.$transaction(async (tx) => {
    // 1. Criar a função (Role) de Super Admin (se não existir)
    const superAdminRole = await tx.role.upsert({
      where: { name: "superadmin" },
      update: {},
      create: {
        name: "superadmin",
        description: "Acesso total ao sistema.",
        isSuperAdmin: true,
      },
    });
    console.log(`Função '${superAdminRole.name}' criada/confirmada.`);

    // 2. Criar uma clínica "Mestre" para o Super Admin (se não existir)
    const masterClinic = await tx.clinic.upsert({
      where: { taxId: "00000000000000" }, // CNPJ fictício para a clínica mestre
      update: {},
      create: {
        name: "AURA System Admin",
        taxId: "00000000000000",
        status: ClinicStatus.ACTIVE, // <-- Nasce ATIVA, bypassando o pagamento
      },
    });
    console.log(`Clínica '${masterClinic.name}' criada/confirmada.`);

    // 3. Criar o usuário Super Admin (se não existir)
    const superAdminUser = await tx.user.upsert({
      where: { email: superAdminEmail },
      update: {},
      create: {
        fullName: "Administrador do Sistema",
        email: superAdminEmail,
        passwordHash: hashedPassword,
        clinicId: masterClinic.id,
        roleId: superAdminRole.id,
        cpf: "00000000000",
      },
    });
    console.log(
      `Usuário Super Admin '${superAdminUser.email}' criado/confirmado.`
    );
  });

  console.log("Seed script finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro ao executar o seed script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
