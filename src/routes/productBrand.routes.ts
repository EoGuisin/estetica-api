import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProductBrandController } from "../controllers/productBrand.controller";

export async function productBrandRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProductBrandController.create);
  app.get("/", ProductBrandController.list);
  app.get("/:id", ProductBrandController.getById);
  app.put("/:id", ProductBrandController.update);
  app.delete("/:id", ProductBrandController.delete);
}
