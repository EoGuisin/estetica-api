import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "../schemas/supplier.schema";

export class SupplierService {
  static async create(data: CreateSupplierInput, clinicId: string) {
    return prisma.supplier.create({
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
    const where: Prisma.SupplierWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [suppliers, totalCount] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.supplier.count({ where }),
    ]);

    return { data: suppliers, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.supplier.findFirst({
      where: { id, clinicId },
    });
  }

  static async update(id: string, data: UpdateSupplierInput, clinicId: string) {
    await prisma.supplier.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.supplier.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.supplier.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se o fornecedor tiver movimentações de estoque.
    const movementCount = await prisma.stockMovement.count({
      where: { supplierId: id },
    });

    if (movementCount > 0) {
      throw new Error("SUPPLIER_IN_USE");
    }

    return prisma.supplier.delete({ where: { id } });
  }
}
