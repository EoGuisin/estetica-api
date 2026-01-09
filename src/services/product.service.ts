import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductInput,
  UpdateProductInput,
} from "../schemas/product.schema";

export class ProductService {
  /**
   * Cria um novo produto, validando se a categoria e marca pertencem à clínica.
   */
  static async create(data: CreateProductInput, clinicId: string) {
    const { categoryId, brandId } = data;

    return prisma.$transaction(async (tx) => {
      await tx.productCategory.findFirstOrThrow({
        where: { id: categoryId, clinicId },
      });
      await tx.productBrand.findFirstOrThrow({
        where: { id: brandId, clinicId },
      });

      const product = await tx.product.create({
        data: {
          ...data,
          clinicId,
        },
      });

      return product;
    });
  }

  /**
   * Lista os produtos da clínica com paginação e filtros.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    sku?: string
  ) {
    const where: Prisma.ProductWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (sku) {
      where.sku = { contains: sku, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [products, totalCount] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          stockMovements: {
            where: { type: "ENTRY" },
            select: {
              id: true,
              expiryDate: true,
              type: true,
              quantity: true,
              date: true,
              invoiceNumber: true,
            },
            orderBy: { date: "desc" },
          },
        },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where }),
    ]);

    return { data: products, totalCount };
  }

  /**
   * Busca um produto específico pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.product.findFirst({
      where: { id, clinicId },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Atualiza um produto, validando as chaves estrangeiras se forem alteradas.
   */
  static async update(id: string, data: UpdateProductInput, clinicId: string) {
    const { categoryId, brandId } = data;

    return prisma.$transaction(async (tx) => {
      // Garante que o produto a ser atualizado pertence à clínica
      await tx.product.findFirstOrThrow({ where: { id, clinicId } });

      // Se a categoria for alterada, valida a nova categoria
      if (categoryId) {
        await tx.productCategory.findFirstOrThrow({
          where: { id: categoryId, clinicId },
        });
      }
      // Se a marca for alterada, valida a nova marca
      if (brandId) {
        await tx.productBrand.findFirstOrThrow({
          where: { id: brandId, clinicId },
        });
      }

      return tx.product.update({
        where: { id },
        data,
      });
    });
  }

  /**
   * Deleta um produto, verificando antes se ele possui movimentações de estoque.
   */
  static async delete(id: string, clinicId: string) {
    await prisma.product.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Impede a exclusão se o produto tiver histórico de movimentação.
    const movementCount = await prisma.stockMovement.count({
      where: { productId: id },
    });

    if (movementCount > 0) {
      throw new Error("PRODUCT_IN_USE");
    }

    return prisma.product.delete({ where: { id } });
  }
}
