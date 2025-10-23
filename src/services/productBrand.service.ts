import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductBrandInput,
  UpdateProductBrandInput,
} from "../schemas/productBrand.schema";

export class ProductBrandService {
  static async create(data: CreateProductBrandInput, clinicId: string) {
    return prisma.productBrand.create({
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
    const where: Prisma.ProductBrandWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [brands, totalCount] = await prisma.$transaction([
      prisma.productBrand.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.productBrand.count({ where }),
    ]);

    return { data: brands, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.productBrand.findFirst({
      where: { id, clinicId },
    });
  }

  static async update(
    id: string,
    data: UpdateProductBrandInput,
    clinicId: string
  ) {
    await prisma.productBrand.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.productBrand.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.productBrand.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se a marca estiver em uso.
    const productCount = await prisma.product.count({
      where: { brandId: id },
    });

    if (productCount > 0) {
      throw new Error("BRAND_IN_USE");
    }

    return prisma.productBrand.delete({ where: { id } });
  }
}
