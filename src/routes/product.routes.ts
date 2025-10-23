import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProductController } from "../controllers/product.controller";

export async function productRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProductController.create);
  app.get("/", ProductController.list);
  app.get("/:id", ProductController.getById);
  app.put("/:id", ProductController.update);
  app.delete("/:id", ProductController.delete);
}
