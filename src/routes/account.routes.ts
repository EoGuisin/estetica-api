// src/routes/account.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AccountController } from "../controllers/account.controller";

export async function accountRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/clinics", AccountController.listClinics);
  app.post("/clinics", AccountController.createClinic);
  app.get("/subscription", AccountController.getSubscription);

  app.get("/stats", AccountController.getStats);
  app.get("/my-clinics", AccountController.listMyClinics);
}
