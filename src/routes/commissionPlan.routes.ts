import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { CommissionPlanController } from "../controllers/commissionPlan.controller";

export async function commissionPlanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", CommissionPlanController.create);
  app.get("/", CommissionPlanController.list);
  app.get("/:id", CommissionPlanController.getById);
  app.put("/:id", CommissionPlanController.update);
  app.delete("/:id", CommissionPlanController.delete);
}
