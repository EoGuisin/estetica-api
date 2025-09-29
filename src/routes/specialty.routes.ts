// src/routes/specialty.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { SpecialtyController } from "../controllers/specialty.controller";

export async function specialtyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/", SpecialtyController.list);
  app.get("/:id", SpecialtyController.getById);
  app.post("/", SpecialtyController.create);
  app.put("/:id", SpecialtyController.update);
  app.delete("/:id", SpecialtyController.delete);
}
