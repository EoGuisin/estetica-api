import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { CommissionRecordController } from "../controllers/commissionRecord.controller";

export async function commissionRecordRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Endpoint para listar os registros de comissão
  app.get("/", CommissionRecordController.list);

  // Endpoint para marcar uma comissão como paga
  app.patch("/:id/pay", CommissionRecordController.markAsPaid);
}
