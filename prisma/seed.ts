// prisma/seed.ts
import { PrismaClient, RoleType } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const roles = [
    // Adicionado o superadmin aqui para garantir que ele sempre exista
    { name: "superadmin", type: RoleType.ADMIN, isSuperAdmin: true },
    { name: "Admin", type: RoleType.ADMIN },
    { name: "Profissional", type: RoleType.PROFESSIONAL },
    { name: "Secretária", type: RoleType.SECRETARY },
    { name: "Financeiro", type: RoleType.FINANCIAL },
  ];

  for (const role of roles) {
    // Upsert vai criar o papel se não existir, ou não fazer nada se já existir.
    // Isso torna o script seguro para ser rodado várias vezes.
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
    console.log(`Ensured role exists: ${role.name}`);
  }

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
