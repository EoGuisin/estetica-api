import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from "../schemas/expenseCategory.schema";

export class ExpenseCategoryService {
  static async create(data: CreateExpenseCategoryInput, clinicId: string) {
    return prisma.expenseCategory.create({ data: { ...data, clinicId } });
  }

  static async list(clinicId: string, name?: string) {
    const where: Prisma.ExpenseCategoryWhereInput = { clinicId };
    if (name) where.name = { contains: name, mode: "insensitive" };
    return prisma.expenseCategory.findMany({ where, orderBy: { name: "asc" } });
  }

  static async getById(id: string, clinicId: string) {
    return prisma.expenseCategory.findFirst({ where: { id, clinicId } });
  }

  static async update(
    id: string,
    clinicId: string,
    data: UpdateExpenseCategoryInput
  ) {
    await prisma.expenseCategory.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.expenseCategory.update({ where: { id }, data });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.expenseCategory.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Não permitir exclusão se usada em despesas
    const expenseCount = await prisma.expense.count({
      where: { categoryId: id },
    });
    if (expenseCount > 0) {
      throw new Error("CATEGORY_IN_USE");
    }
    return prisma.expenseCategory.delete({ where: { id } });
  }
}
