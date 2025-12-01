import { FastifyInstance } from "fastify";
import { ClinicController } from "../controllers/clinic.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export async function clinicRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ClinicController.create);
  app.put("/:id", ClinicController.update);
  app.delete("/:id", ClinicController.delete);
}
