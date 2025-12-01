// src/routes/account.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AccountController } from "../controllers/account.controller";

export async function accountRoutes(app: FastifyInstance) {
  // ATENÇÃO:
  // Estas rotas só precisam do authMiddleware.
  // Elas NÃO usam o clinicAccessMiddleware, pois operam
  // no nível da "Conta", e não de uma clínica específica.
  app.addHook("preHandler", authMiddleware);

  app.get("/clinics", AccountController.listClinics);
  app.post("/clinics", AccountController.createClinic);
  app.get("/subscription", AccountController.getSubscription);
}
