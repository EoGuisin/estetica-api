import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AiController } from "../controllers/ai.controller";

export async function aiRoutes(app: FastifyInstance) {
  // Opcional: proteger a rota para só usuários logados usarem a IA
  app.addHook("preHandler", authMiddleware);

  app.post("/chat", AiController.ask);
}
