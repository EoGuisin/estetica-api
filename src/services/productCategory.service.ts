import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
} from "../schemas/productCategory.schema";

export class ProductCategoryService {
  /**
   * Cria uma nova categoria de produto associada a uma clínica.
   */
  static async create(data: CreateProductCategoryInput, clinicId: string) {
    return prisma.productCategory.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  /**
   * Lista todas as categorias de uma clínica com paginação e filtro por nome.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.ProductCategoryWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [categories, totalCount] = await prisma.$transaction([
      prisma.productCategory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return { data: categories, totalCount };
  }

  /**
   * Busca uma categoria específica pelo ID, garantindo que pertença à clínica.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.productCategory.findFirst({
      where: { id, clinicId },
    });
  }

  /**
   * Atualiza uma categoria, garantindo que ela pertença à clínica.
   */
  static async update(
    id: string,
    data: UpdateProductCategoryInput,
    clinicId: string
  ) {
    // Garante que o registro a ser atualizado pertence à clínica do usuário logado
    await prisma.productCategory.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.productCategory.update({
      where: { id },
      data,
    });
  }

  /**
   * Deleta uma categoria, mas antes verifica se ela não está sendo usada por nenhum produto.
   */
  static async delete(id: string, clinicId: string) {
    // Garante que a categoria existe e pertence à clínica
    const category = await prisma.productCategory.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se a categoria estiver em uso.
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      // Lança um erro específico que o controller pode capturar
      throw new Error("CATEGORY_IN_USE");
    }

    return prisma.productCategory.delete({ where: { id } });
  }
}
