import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProfessionalCouncilController } from "../controllers/professionalCouncil.controller";

export async function professionalCouncilRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProfessionalCouncilController.create);
  app.get("/", ProfessionalCouncilController.list);
  app.get("/:id", ProfessionalCouncilController.getById);
  app.put("/:id", ProfessionalCouncilController.update);
  app.delete("/:id", ProfessionalCouncilController.delete);
}
