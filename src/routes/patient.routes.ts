// src/routes/patient.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { PatientController } from "../controllers/patient.controller";

export async function patientRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", PatientController.create);
  app.get("/", PatientController.list); // LISTAR TODOS
  app.get("/:id", PatientController.getById); // BUSCAR UM
  app.put("/:id", PatientController.update); // ATUALIZAR
  app.delete("/:id", PatientController.delete); // DELETAR
}
