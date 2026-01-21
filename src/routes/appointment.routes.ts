// src/routes/appointment.routes.ts
import { FastifyInstance } from "fastify";
import { AppointmentController } from "../controllers/appointment.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export async function appointmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);
  app.post("/", AppointmentController.create);
  app.get("/patients", AppointmentController.listPatients);
  app.get("/treatment-plans/patient/:patientId", AppointmentController.listTreatmentPlansByPatient);
  app.patch("/:appointmentId/status", AppointmentController.updateStatus);
}
