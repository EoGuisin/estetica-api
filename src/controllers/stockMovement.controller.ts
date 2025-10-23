import { FastifyRequest, FastifyReply } from "fastify";
import { createStockMovementSchema } from "../schemas/stockMovement.schema";
import { StockMovementService } from "../services/stockMovement.service";

export class StockMovementController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createStockMovementSchema.parse(request.body);

      const movement = await StockMovementService.create(data, clinicId);
      return reply.status(201).send(movement);
    } catch (error: any) {
      // Trata o erro de estoque insuficiente lançado pelo serviço
      if (error.message === "Estoque insuficiente para a saída.") {
        return reply.status(400).send({ message: error.message });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "15",
      productId,
      type,
    } = request.query as {
      page?: string;
      pageSize?: string;
      productId?: string;
      type?: "ENTRY" | "EXIT";
    };

    const result = await StockMovementService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { productId, type }
    );
    return reply.send(result);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };

      await StockMovementService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message.includes("estoque ficaria negativo")) {
        return reply.status(409).send({ message: error.message });
      }
      throw error;
    }
  }
}
