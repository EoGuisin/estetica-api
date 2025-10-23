import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { PrescriptionController } from "../controllers/prescription.controller";

export async function prescriptionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", PrescriptionController.create);
  app.get("/patient/:patientId", PrescriptionController.findByPatientId);
  app.put("/:prescriptionId", PrescriptionController.update);
  app.delete("/:prescriptionId", PrescriptionController.delete);
  app.get("/:prescriptionId/download", PrescriptionController.downloadPdf);
}
