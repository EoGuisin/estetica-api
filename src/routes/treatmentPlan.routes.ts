import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { TreatmentPlanController } from "../controllers/treatmentPlan.controller";

export async function treatmentPlanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", TreatmentPlanController.create);
  app.get("/", TreatmentPlanController.list);
  app.get("/:id", TreatmentPlanController.getById);
}
