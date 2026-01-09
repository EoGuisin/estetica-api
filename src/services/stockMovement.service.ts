import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateStockMovementInput } from "../schemas/stockMovement.schema";

export class StockMovementService {
  /**
   * Cria uma nova movimentação de estoque de forma transacional,
   * atualizando a quantidade do produto correspondente.
   */
  static async create(data: CreateStockMovementInput, clinicId: string) {
    const { productId, type, quantity, expenseDueDate, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Busca e valida produto (igual ao anterior)
      const product = await tx.product.findFirstOrThrow({
        where: { id: productId, clinicId },
      });

      // 2. Calcula novo estoque (igual ao anterior)
      let newStock;
      if (type === "ENTRY") {
        newStock = product.currentStock + quantity;
      } else {
        if (product.currentStock < quantity) {
          throw new Error("Estoque insuficiente para a saída.");
        }
        newStock = product.currentStock - quantity;
      }

      // 3. Atualiza produto
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      // 4. Cria movimentação
      const movement = await tx.stockMovement.create({
        data: {
          ...rest,
          productId,
          type,
          quantity,
          date: new Date(data.date),
          // Garante que se a string for vazia, salve como nulo no banco
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        },
      });

      // 5. CRIAÇÃO OBRIGATÓRIA DE DESPESA
      if (type === "ENTRY") {
        // Garantido pelo Zod que totalValue e expenseDueDate existem aqui
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
            dueDate: new Date(expenseDueDate!), // "!" pois o Zod já garantiu
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
