// src/services/account.service.ts
import { prisma } from "../lib/prisma";
import { CreateClinicInput } from "../schemas/account.schema";

export class AccountService {
  /**
   * Lista todas as clínicas que pertencem a uma conta.
   */
  static async listClinics(accountId: string) {
    return prisma.clinic.findMany({
      where: { accountId },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Busca os detalhes da assinatura da conta.
   */
  static async getSubscription(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        subscription: {
          include: {
            plan: true, // Inclui os detalhes do plano (limite, etc.)
          },
        },
      },
    });
    return account?.subscription || null;
  }

  /**
   * Cria uma nova clínica, mas antes verifica o limite do plano.
   */
  static async createClinic(accountId: string, data: CreateClinicInput) {
    // 1. Verificar se o CNPJ já existe em *qualquer* clínica
    const existingClinic = await prisma.clinic.findUnique({
      where: { taxId: data.taxId },
    });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    // 2. Buscar a conta, o plano e o N° de clínicas atuais
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        _count: { select: { clinics: true } },
        subscription: { include: { plan: true } },
      },
    });

    if (!account) {
      throw new Error("Conta não encontrada."); // Erro de servidor
    }
    if (!account.subscription || !account.subscription.plan) {
      throw {
        code: "PAYMENT_REQUIRED",
        message: "Nenhum plano de assinatura ativo.",
      };
    }

    // 3. Verificar o limite
    const currentClinics = account._count.clinics;
    // const clinicLimit = account.subscription.plan.clinicLimit;

    // // (Use 0 ou -1 para ilimitado, se desejar)
    // if (clinicLimit > 0 && currentClinics >= clinicLimit) {
    //   throw {
    //     code: "FORBIDDEN",
    //     message: `Limite de ${clinicLimit} clínicas atingido. Faça upgrade do seu plano.`,
    //   };
    // }

    // 4. Tudo certo, criar a clínica
    return prisma.clinic.create({
      data: {
        ...data,
        accountId: accountId,
        status: "ACTIVE", // Ou PENDING_PAYMENT, dependendo da sua regra
      },
    });
  }
}
