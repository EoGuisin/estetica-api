import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { BankAccountController } from "../controllers/bankAccount.controller";

export async function bankAccountRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", BankAccountController.create);
  app.get("/", BankAccountController.list);
  app.get("/:id", BankAccountController.getById);
  app.put("/:id", BankAccountController.update);
  app.delete("/:id", BankAccountController.delete);
}
