import { FastifyInstance } from "fastify";
import { AdminController } from "../controllers/admin.controller";
import { AdminReportsController } from "../controllers/adminReports.controller";
import { AdminAiController } from "../controllers/adminAi.controller";
import { adminGuard } from "../middleware/adminGuard";
import { authMiddleware } from "../middleware/auth.middleware";

export async function adminRoutes(app: FastifyInstance) {
  app.post("/test-accounts", AdminController.createTestAccount);
  app.delete("/test-accounts/:accountId", AdminController.wipeTestAccount);

  app.register(async (dashboardBlock) => {
    dashboardBlock.addHook("preHandler", adminGuard);
    dashboardBlock.get("/verify", async () => {
      return { valid: true };
    });
    dashboardBlock.get("/reports/overview", AdminReportsController.getOverview);
    dashboardBlock.get(
      "/reports/conversion",
      AdminReportsController.getConversion
    );
    dashboardBlock.get(
      "/reports/cancelations",
      AdminReportsController.getCancelations
    );
  });

  // GRUPO 2: Novas rotas da IA (Usam o token JWT normal do seu usuário logado)
  app.register(async (aiBlock) => {
    aiBlock.addHook("preHandler", authMiddleware);

    aiBlock.addHook("preHandler", async (request, reply) => {
      const user = request.user as any;

      if (!user.isSystemOwner) {
        return reply.status(403).send({
          message: "Apenas o administrador master pode treinar a IA.",
        });
      }
    });

    aiBlock.get("/ai-articles", AdminAiController.listArticles);
    aiBlock.post("/ai-articles", AdminAiController.createArticle);
    aiBlock.delete("/ai-articles/:id", AdminAiController.deleteArticle);
  });
}
