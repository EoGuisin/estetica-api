// src/routes/report.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ReportController } from "../controllers/report.controller";

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // GET /reports/appointments
  app.get("/appointments", ReportController.generateAppointmentsReport);

  // GET /reports/professional-value
  app.get("/professional-value", ReportController.generateProfessionalValueReport);

  // GET /reports/commissions
  app.get("/commissions", ReportController.generateCommissionReport);

  // GET /reports/attended-patients
  app.get("/attended-patients", ReportController.generateAttendedPatientsReport);

  // GET /reports/accounts-receivable
  app.get("/accounts-receivable", ReportController.generateAccountsReceivableReport);

  // GET /reports/accounts-payable
  app.get("/accounts-payable", ReportController.generateAccountsPayableReport);
}
