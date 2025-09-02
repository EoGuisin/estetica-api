// src/routes/dashboard.routes.ts
import { FastifyInstance } from "fastify";
import { DashboardController } from "../controllers/dashboard.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export async function dashboardRoutes(app: FastifyInstance) {
  // Adiciona o hook 'preHandler' para executar o middleware em todas as rotas deste arquivo
  app.addHook("preHandler", authMiddleware);

  app.get("/professionals", DashboardController.getProfessionals);
  app.get("/appointments", DashboardController.getAppointments);
}