import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ExpenseCategoryController } from "../controllers/expenseCategory.controller";

export async function expenseCategoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ExpenseCategoryController.create);
  app.get("/", ExpenseCategoryController.list);
  app.get("/:id", ExpenseCategoryController.getById);
  app.put("/:id", ExpenseCategoryController.update);
  app.delete("/:id", ExpenseCategoryController.delete);
}
