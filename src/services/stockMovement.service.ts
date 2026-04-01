import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateStockMovementInput } from "../schemas/stockMovement.schema";

export class StockMovementService {
  static async create(data: CreateStockMovementInput, clinicId: string) {
    const { productId, type, quantity, expenseDueDate, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirstOrThrow({
        where: { id: productId, clinicId },
      });

      let newStock;
      if (type === "ENTRY") {
        newStock = product.currentStock + quantity;
      } else {
        if (product.currentStock < quantity) {
          throw new Error("Estoque insuficiente para a saída.");
        }
        newStock = product.currentStock - quantity;
      }

      let costToUpdate = product.lastCostPrice;

      if (type === "ENTRY" && rest.totalValue) {
        const unitCost = Number(rest.totalValue) / quantity;
        costToUpdate = new Prisma.Decimal(unitCost);
      }

      await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: newStock,
          lastCostPrice: costToUpdate,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          ...rest,
          productId,
          type,
          quantity,
          date: new Date(data.date),
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        },
      });

      if (type === "ENTRY") {
        if (!rest.totalValue)
          throw new Error("Valor total é necessário para entradas.");

        const description = `Compra Estoque: ${product.name} ${
          rest.invoiceNumber ? `(NF: ${rest.invoiceNumber})` : ""
        }`;

        await tx.expense.create({
          data: {
            clinicId,
            description,
            amount: rest.totalValue,
            dueDate: new Date(expenseDueDate!),
            status: "PENDING",
            supplierId: rest.supplierId || null,
            notes: `Gerado automaticamente via entrada de estoque ID: ${movement.id}`,
          },
        });
      }

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
      // Encontra a movimentação e garante que pertence à clínica
      const movement = await tx.stockMovement.findFirstOrThrow({
        where: { id, product: { clinicId } },
        include: { product: true },
      });

      // Calcula o estoque revertido
      let revertedStock;
      if (movement.type === "ENTRY") {
        revertedStock = movement.product.currentStock - movement.quantity;
        if (revertedStock < 0) {
          throw new Error(
            "Não é possível excluir esta entrada, pois os itens já foram utilizados (estoque ficaria negativo)."
          );
        }
      } else {
        revertedStock = movement.product.currentStock + movement.quantity;
      }

      // Atualiza o estoque do produto com o valor revertido
      // PS: Não mexi no lastCostPrice aqui por padrão de mercado
      await tx.product.update({
        where: { id: movement.productId },
        data: { currentStock: revertedStock },
      });

      return tx.stockMovement.delete({ where: { id } });
    });
  }
}
