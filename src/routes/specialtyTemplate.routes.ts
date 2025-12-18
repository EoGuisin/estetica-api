import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { SpecialtyTemplateController } from "../controllers/specialtyTemplate.controller";

export async function specialtyTemplateRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Get available variables for templates
  app.get("/variables", SpecialtyTemplateController.getVariables);

  // CRUD routes
  app.post("/", SpecialtyTemplateController.create);

  // CORREÇÃO: Usar 'listBySpecialty' que é o nome real no Controller
  app.get(
    "/specialty/:specialtyId",
    SpecialtyTemplateController.listBySpecialty
  );

  // CORREÇÃO: Usar 'getById' e padronizar o parametro para ':id'
  app.get("/:id", SpecialtyTemplateController.getById);

  // Padronizar para ':id'
  app.put("/:id", SpecialtyTemplateController.update);
  app.delete("/:id", SpecialtyTemplateController.delete);
}
