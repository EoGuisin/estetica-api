import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProductCategoryController } from "../controllers/productCategory.controller";

export async function productCategoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProductCategoryController.create);
  app.get("/", ProductCategoryController.list);
  app.get("/:id", ProductCategoryController.getById);
  app.put("/:id", ProductCategoryController.update);
  app.delete("/:id", ProductCategoryController.delete);
}
