import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AnamnesisController } from "../controllers/anamnesis.controller";

export async function anamnesisRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/templates", AnamnesisController.listTemplates);
  app.post("/templates", AnamnesisController.createTemplate);
  app.get("/templates/:id", AnamnesisController.getTemplateById);
  app.put("/templates/:id", AnamnesisController.updateTemplate);
  app.delete("/templates/:id", AnamnesisController.deleteTemplate);
  app.post("/templates/:id/duplicate", AnamnesisController.duplicateTemplate);

  app.get(
    "/assessments/patient/:patientId",
    AnamnesisController.listPatientAssessments
  );
  app.get(
    "/assessments/appointment/:appointmentId",
    AnamnesisController.getAssessmentByAppointment
  );
  app.post(
    "/assessments/appointment/:appointmentId",
    AnamnesisController.createOrUpdateAssessment
  );
  app.get("/assessments/:id", AnamnesisController.getAssessmentById);
}
