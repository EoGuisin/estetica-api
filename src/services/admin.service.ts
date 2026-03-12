// src/services/admin.service.ts
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import { CreateTestAccountInput } from "../schemas/admin.schema";

export class AdminService {
  static async createTestAccount(data: CreateTestAccountInput) {
    // 1. Verifica se o e-mail ou CNPJ já existem
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw { code: "CONFLICT", message: "Este e-mail já está em uso." };
    }

    const existingClinic = await prisma.clinic.findUnique({
      where: { taxId: data.taxId },
    });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // 2. Cria tudo dentro de uma transaction para garantir consistência
    return prisma.$transaction(async (tx) => {
      // Cria o Usuário (Dono)
      const user = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          passwordHash,
          isProfessional: data.isProfessional,
        },
      });

      // Cria a Conta
      const account = await tx.account.create({
        data: { ownerId: user.id },
      });

      // Cria a Clínica já como ACTIVE
      const clinic = await tx.clinic.create({
        data: {
          name: data.clinicName,
          taxId: data.taxId,
          status: "ACTIVE", // Bypass do PENDING_PAYMENT
          accountId: account.id,
          users: { connect: { id: user.id } },
        },
      });

      // Busca um plano existente (ou cria um fallback se não houver)
      let defaultPlan = await tx.subscriptionPlan.findFirst();

      if (!defaultPlan) {
        defaultPlan = await tx.subscriptionPlan.create({
          data: {
            name: "Plano Sistema Teste",
            price: 0,
            maxUsers: 999,
          },
        });
      }

      // Cria a assinatura ativa
      await tx.subscription.create({
        data: {
          accountId: account.id,
          planId: defaultPlan.id,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
          ), // 1 ano
          currentMaxUsers: 999,
          currentMaxStorage: 10737418240,
          activeCrm: true,
          activeAi: true,
          activeApp: true,
          activeFunnel: true,
          activeWhats: true,
        },
      });

      return {
        message: "Conta de teste criada com sucesso",
        accountId: account.id,
        clinicId: clinic.id,
        userId: user.id,
      };
    });
  }

  static async wipeTestAccount(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { clinics: true },
    });

    if (!account) {
      throw { code: "NOT_FOUND", message: "Conta não encontrada." };
    }

    await prisma.$transaction(async (tx) => {
      for (const clinic of account.clinics) {
        // 1. LIMPA O FINANCEIRO E COMISSÕES (Folhas soltas sem Cascade)
        await tx.financialTransaction.deleteMany({
          where: { clinicId: clinic.id },
        });
        await tx.cashRegisterSession.deleteMany({
          where: { clinicId: clinic.id },
        });
        await tx.commissionRecord.deleteMany({
          where: { clinicId: clinic.id },
        });
        await tx.paymentInstallment.deleteMany({
          where: { clinicId: clinic.id },
        });
        await tx.expense.deleteMany({ where: { clinicId: clinic.id } });

        // 2. LIMPA O ESTOQUE (Movimentações seguram os produtos)
        await tx.stockMovement.deleteMany({
          where: { product: { clinicId: clinic.id } },
        });
        await tx.product.deleteMany({ where: { clinicId: clinic.id } });

        // 3. A MÁGICA: APAGA OS PACIENTES
        // Obs: Como você configurou 'onDelete: Cascade' no Paciente, apagar ele
        // destrói automaticamente os Agendamentos, Prontuários, Planos de Tratamento e Anexos!
        await tx.patient.deleteMany({ where: { clinicId: clinic.id } });

        // 4. LIMPA OS USUÁRIOS EXTRAS (Funcionários da conta teste)
        // Precisamos apagar antes de apagar os Cargos (Roles) e Conselhos
        await tx.user.deleteMany({
          where: {
            clinics: { some: { id: clinic.id } },
            id: { not: account.ownerId }, // Protege o dono para apagarmos no final
          },
        });

        // 5. LIMPA OS CATÁLOGOS E CONFIGURAÇÕES DA CLÍNICA
        await tx.procedure.deleteMany({ where: { clinicId: clinic.id } });
        await tx.specialtyTemplate.deleteMany({
          where: { clinicId: clinic.id },
        });
        await tx.supplier.deleteMany({ where: { clinicId: clinic.id } });
        await tx.productBrand.deleteMany({ where: { clinicId: clinic.id } });
        await tx.productCategory.deleteMany({ where: { clinicId: clinic.id } });
        await tx.expenseCategory.deleteMany({ where: { clinicId: clinic.id } });
        await tx.bankAccount.deleteMany({ where: { clinicId: clinic.id } });
        await tx.commissionPlan.deleteMany({ where: { clinicId: clinic.id } });
        await tx.professionalCouncil.deleteMany({
          where: { clinicId: clinic.id },
        });
        await tx.role.deleteMany({ where: { clinicId: clinic.id } });
        await tx.trafficSource.deleteMany({ where: { clinicId: clinic.id } });
        await tx.specialty.deleteMany({ where: { clinicId: clinic.id } });
        await tx.appointmentType.deleteMany({ where: { clinicId: clinic.id } });
        await tx.anamnesisTemplate.deleteMany({
          where: { clinicId: clinic.id },
        });
      }

      // 6. CORTA O TRONCO (Isso apaga a Conta, a Clínica e a Assinatura)
      await tx.account.delete({ where: { id: accountId } });

      // 7. APAGA O DONO DA CONTA
      await tx.user.delete({ where: { id: account.ownerId } });
    });

    return {
      message:
        "Conta e todos os dados vinculados foram completamente apagados.",
    };
  }
}
