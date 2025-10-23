import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { SpecialtyTemplateController } from "../controllers/specialtyTemplate.controller";

export async function specialtyTemplateRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Get available variables for templates
  app.get("/variables", SpecialtyTemplateController.getVariables);

  // CRUD routes
  app.post("/", SpecialtyTemplateController.create);
  app.get("/specialty/:specialtyId", SpecialtyTemplateController.findMany);
  app.get("/:templateId", SpecialtyTemplateController.findById);
  app.put("/:templateId", SpecialtyTemplateController.update);
  app.delete("/:templateId", SpecialtyTemplateController.delete);
}
