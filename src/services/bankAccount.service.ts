import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
} from "../schemas/bankAccount.schema";
import { z } from "zod";

export class BankAccountService {
  static async create(
    clinicId: string,
    data: z.infer<typeof createBankAccountSchema>
  ) {
    return prisma.bankAccount.create({
      data: {
        ...data,
        clinicId, // Garante vínculo na criação
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.BankAccountWhereInput = { clinicId }; // Garante filtro na listagem
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [data, totalCount] = await prisma.$transaction([
      prisma.bankAccount.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.bankAccount.count({ where }),
    ]);

    return { data, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId }, // Garante isolamento na busca única
    });
  }

  static async update(
    id: string,
    clinicId: string,
    data: z.infer<typeof updateBankAccountSchema>
  ) {
    // 1. Verificação de Segurança (Propriedade)
    await prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId },
    });

    // 2. Atualização
    return prisma.bankAccount.update({
      where: { id },
      data: {
        name: data.name,
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    // 1. Verificação de Segurança (Propriedade)
    await prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId },
    });

    // 2. Verificação de Dependências (Regra de Negócio)
    // Adicionei clinicId aqui também para manter consistência total
    const transactionCount = await prisma.financialTransaction.count({
      where: { bankAccountId: id, clinicId },
    });
    const sessionCount = await prisma.cashRegisterSession.count({
      where: { bankAccountId: id, clinicId },
    });

    if (transactionCount > 0 || sessionCount > 0) {
      throw new Error("ACCOUNT_IN_USE");
    }

    return prisma.bankAccount.delete({ where: { id } });
  }
}
