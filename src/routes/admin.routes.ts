import { FastifyInstance } from "fastify";
import { AdminController } from "../controllers/admin.controller";
import { AdminReportsController } from "../controllers/adminReports.controller";
import { adminGuard } from "../middleware/adminGuard"; // <-- Faltava importar o cadeado!

export async function adminRoutes(app: FastifyInstance) {
  app.post("/test-accounts", AdminController.createTestAccount);
  app.delete("/test-accounts/:accountId", AdminController.wipeTestAccount);

  app.register(async (dashboardBlock) => {
    dashboardBlock.addHook("preHandler", adminGuard);
    dashboardBlock.get("/verify", async () => {
      return { valid: true };
    });

    // Relatórios também trancados
    dashboardBlock.get("/reports/overview", AdminReportsController.getOverview);
    dashboardBlock.get("/reports/conversion", AdminReportsController.getConversion);
    dashboardBlock.get("/reports/cancelations", AdminReportsController.getCancelations);
  });
}