import { prisma } from "../lib/prisma";

export class ClinicService {
  static async create(ownerId: string, data: { name: string; taxId: string }) {
    // 1. Primeiro, encontramos a Conta (Account) que pertence a este usuário (Dono)
    const account = await prisma.account.findUnique({
      where: { ownerId },
    });

    if (!account) {
      throw new Error(
        "Conta principal não encontrada. Entre em contato com o suporte."
      );
    }

    // 2. Criamos a clínica vinculada a essa conta com status ACTIVE
    return prisma.clinic.create({
      data: {
        name: data.name,
        taxId: data.taxId,
        status: "ACTIVE", // Já nasce ativa conforme seu pedido
        accountId: account.id,
      },
    });
  }

  static async update(id: string, ownerId: string, data: any) {
    // Verifica se a clínica pertence a uma conta que o usuário é dono
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId }, // Garante segurança: só o dono altera
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    return prisma.clinic.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, ownerId: string) {
    // Verifica propriedade
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId },
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    // ATENÇÃO: O delete falhará se houver dados vinculados (pacientes, etc)
    // a menos que o Cascade esteja configurado no Schema do Prisma.
    // Se não estiver, seria necessário deletar os dados filhos antes.
    return prisma.clinic.delete({
      where: { id },
    });
  }
}
