import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { StockMovementController } from "../controllers/stockMovement.controller";

export async function stockMovementRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", StockMovementController.create);
  app.get("/", StockMovementController.list);
  app.delete("/:id", StockMovementController.delete);
}
