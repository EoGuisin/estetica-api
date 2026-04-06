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
    filters: {
      productId?: string;
      type?: "ENTRY" | "EXIT";
      startDate?: string;
      endDate?: string;
      expiryDate?: string;
      supplierId?: string;
    }
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

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    // Filtro por Data da Movimentação (Início e Fim)
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
      }
      if (filters.endDate) {
        where.date.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
      }
    }

    // Filtro pela Data de Vencimento do Lote (pegando o dia todo)
    if (filters.expiryDate) {
      where.expiryDate = {
        gte: new Date(`${filters.expiryDate}T00:00:00.000Z`),
        lte: new Date(`${filters.expiryDate}T23:59:59.999Z`),
      };
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

  static async refundUsage(movementId: string, clinicId: string) {
    return prisma.$transaction(async (tx) => {
      // Busca a movimentação original que foi uma SAÍDA
      const originalMovement = await tx.stockMovement.findFirstOrThrow({
        where: { id: movementId, product: { clinicId }, type: "EXIT" },
        include: { product: true },
      });

      // Devolve o saldo pro estoque do produto
      const newStock =
        originalMovement.product.currentStock + originalMovement.quantity;

      await tx.product.update({
        where: { id: originalMovement.productId },
        data: { currentStock: newStock },
      });

      // Cria a entrada de estorno para ficar salvo no extrato
      return tx.stockMovement.create({
        data: {
          type: "ENTRY",
          quantity: originalMovement.quantity,
          date: new Date(),
          productId: originalMovement.productId,
          appointmentId: originalMovement.appointmentId, // Mantém o vínculo
          notes: `Estorno/Reembolso referente à saída ID: ${movementId}`,
        },
      });
    });
  }
}
