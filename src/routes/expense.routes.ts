import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ExpenseController } from "../controllers/expense.controller";

export async function expenseRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ExpenseController.create);
  app.get("/", ExpenseController.list);
  app.get("/:id", ExpenseController.getById);
  app.put("/:id", ExpenseController.update);
  app.delete("/:id", ExpenseController.delete);

  // Rota para marcar uma despesa como paga
  app.patch("/:id/pay", ExpenseController.markAsPaid);
}
