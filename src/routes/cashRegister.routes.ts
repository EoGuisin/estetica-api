// src/routes/cashRegister.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { CashRegisterController } from "../controllers/cashRegister.controller";

export async function cashRegisterRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Abrir uma nova sessão de caixa
  app.post("/open", CashRegisterController.openSession);

  // Fechar uma sessão de caixa
  app.patch("/:sessionId/close", CashRegisterController.closeSession);

  // Buscar a sessão ATIVA para uma conta (ex: "Caixa Matriz")
  app.get("/active/:bankAccountId", CashRegisterController.getActiveSession);

  // Listar histórico de sessões fechadas (com filtros)
  app.get("/", CashRegisterController.listSessions);

  // Buscar detalhes de UMA sessão específica (para ver o relatório dela)
  app.get("/:sessionId", CashRegisterController.getSessionDetails);
}
