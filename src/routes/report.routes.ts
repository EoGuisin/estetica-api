// src/routes/report.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ReportController } from "../controllers/report.controller";

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // GET /reports/appointments
  app.get("/appointments", ReportController.generateAppointmentsReport);

}
