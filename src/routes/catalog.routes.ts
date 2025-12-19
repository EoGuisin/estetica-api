// src/routes/catalog.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { CatalogController } from "../controllers/catalog.controller";

export async function catalogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Rota genérica para os catálogos
  app.get("/:modelName", CatalogController.list);
  app.get("/:modelName/:id", CatalogController.getById);
  app.post("/:modelName", CatalogController.create);
  app.put("/:modelName/:id", CatalogController.update);
  app.delete("/:modelName/:id", CatalogController.delete);
  app.post("/procedure/import", CatalogController.importProcedures);
}
