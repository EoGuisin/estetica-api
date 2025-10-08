import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AttendanceController } from "../controllers/attendance.controller";

export async function attendanceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Main route for the attendance page
  app.get("/:appointmentId", AttendanceController.getAttendanceData);
  app.put("/:appointmentId", AttendanceController.saveDiagnosis);

  // Routes for attachments
  app.get(
    "/attachments/patient/:patientId",
    AttendanceController.listAttachments
  );
  app.post(
    "/attachments/signed-url",
    AttendanceController.createSignedUploadUrl
  );
  app.post("/attachments", AttendanceController.saveAttachment);
  app.delete(
    "/attachments/:attachmentId",
    AttendanceController.deleteAttachment
  );
}
