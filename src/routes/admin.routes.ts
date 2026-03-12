// src/routes/admin.routes.ts
import { FastifyInstance } from "fastify";
import { AdminController } from "../controllers/admin.controller";

export async function adminRoutes(app: FastifyInstance) {
  // ATENÇÃO: Não adicione authMiddleware aqui! A proteção é via IP no controller.
  app.post("/test-accounts", AdminController.createTestAccount);
  app.delete("/test-accounts/:accountId", AdminController.wipeTestAccount);
}
