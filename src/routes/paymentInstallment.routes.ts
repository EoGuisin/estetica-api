import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { PaymentInstallmentController } from "../controllers/paymentInstallment.controller";

export async function paymentInstallmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Endpoint para registrar o pagamento de uma parcela específica
  app.patch("/:id/pay", PaymentInstallmentController.registerPayment);

  // Endpoint para listar as parcelas com filtros
  app.get("/", PaymentInstallmentController.list);

  // Endpoint para buscar uma parcela específica
  app.get("/:id", PaymentInstallmentController.getById);
}
