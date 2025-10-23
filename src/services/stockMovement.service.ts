import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateStockMovementInput } from "../schemas/stockMovement.schema";

export class StockMovementService {
  /**
   * Cria uma nova movimentação de estoque de forma transacional,
   * atualizando a quantidade do produto correspondente.
   */
  static async create(data: CreateStockMovementInput, clinicId: string) {
    const { productId, type, quantity, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Busca o produto para garantir que ele existe e pertence à clínica.
      const product = await tx.product.findFirstOrThrow({
        where: { id: productId, clinicId },
      });

      // 2. Calcula a nova quantidade em estoque com base no tipo de movimentação.
      let newStock;
      if (type === "ENTRY") {
        newStock = product.currentStock + quantity;
      } else {
        // 'EXIT'
        if (product.currentStock < quantity) {
          // REGRA DE NEGÓCIO: Impede que o estoque fique negativo.
          throw new Error("Estoque insuficiente para a saída.");
        }
        newStock = product.currentStock - quantity;
      }

      // 3. Atualiza o estoque do produto.
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      // 4. Cria o registro da movimentação.
      const movement = await tx.stockMovement.create({
        data: {
          ...rest,
          productId,
          type,
          quantity,
          date: new Date(data.date),
        },
      });

      return movement;
    });
  }

  /**
   * Lista o histórico de movimentações da clínica com paginação e filtros.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: { productId?: string; type?: "ENTRY" | "EXIT" }
  ) {
    const where: Prisma.StockMovementWhereInput = {
      // A segurança é garantida pela verificação do clinicId no produto relacionado.
      product: {
        clinicId: clinicId,
      },
    };

    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const skip = (page - 1) * pageSize;
    const [movements, totalCount] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          supplier: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { date: "desc" },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return { movements, totalCount };
  }

  /**
   * Deleta uma movimentação de forma transacional, revertendo o efeito no estoque.
   */
  static async delete(id: string, clinicId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Encontra a movimentação e garante que pertence à clínica (via produto)
      const movement = await tx.stockMovement.findFirstOrThrow({
        where: { id, product: { clinicId } },
        include: { product: true },
      });

      // 2. Calcula o estoque revertido
      let revertedStock;
      if (movement.type === "ENTRY") {
        revertedStock = movement.product.currentStock - movement.quantity;
        // REGRA DE NEGÓCIO: Impede a exclusão de uma entrada se isso for deixar o estoque negativo.
        if (revertedStock < 0) {
          throw new Error(
            "Não é possível excluir esta entrada, pois os itens já foram utilizados (estoque ficaria negativo)."
          );
        }
      } else {
        // 'EXIT'
        revertedStock = movement.product.currentStock + movement.quantity;
      }

      // 3. Atualiza o estoque do produto com o valor revertido
      await tx.product.update({
        where: { id: movement.productId },
        data: { currentStock: revertedStock },
      });

      // 4. Deleta a movimentação
      return tx.stockMovement.delete({ where: { id } });
    });
  }
}
