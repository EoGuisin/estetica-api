import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { MedicalReportController } from "../controllers/medicalReport.controller";

export async function medicalReportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", MedicalReportController.create);
  app.get("/patient/:patientId", MedicalReportController.findByPatientId);
  app.put("/:reportId", MedicalReportController.update);
  app.delete("/:reportId", MedicalReportController.delete);
  app.get("/:reportId/download", MedicalReportController.downloadPdf);
}
