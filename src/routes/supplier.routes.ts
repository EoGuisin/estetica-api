import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { SupplierController } from "../controllers/supplier.controller";

export async function supplierRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", SupplierController.create);
  app.get("/", SupplierController.list);
  app.get("/:id", SupplierController.getById);
  app.put("/:id", SupplierController.update);
  app.delete("/:id", SupplierController.delete);
}
