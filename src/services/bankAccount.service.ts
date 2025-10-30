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
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.BankAccountWhereInput = { clinicId };
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
      where: { id, clinicId },
    });
  }

  static async update(
    id: string,
    clinicId: string,
    data: z.infer<typeof updateBankAccountSchema>
  ) {
    await prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.bankAccount.update({
      where: { id },
      data: {
        name: data.name, // Permite apenas a atualização do nome
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.bankAccount.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir exclusão se a conta tiver transações
    // ou sessões de caixa (abertas ou fechadas).
    const transactionCount = await prisma.financialTransaction.count({
      where: { bankAccountId: id },
    });
    const sessionCount = await prisma.cashRegisterSession.count({
      where: { bankAccountId: id },
    });

    if (transactionCount > 0 || sessionCount > 0) {
      throw new Error("ACCOUNT_IN_USE");
    }

    return prisma.bankAccount.delete({ where: { id } });
  }
}
