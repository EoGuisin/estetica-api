// src/routes/professional.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { UserController } from "../controllers/user.controller";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", UserController.create);
  app.get("/", UserController.list);
  app.get("/:id", UserController.getById);
  app.put("/:id", UserController.update);
  app.delete("/:id", UserController.delete);
}
