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
  app.get(
    "/attachments/:attachmentId/download",
    AttendanceController.downloadAttachment
  );

  // Routes for before/after images
  app.get(
    "/before-after/:patientId",
    AttendanceController.getBeforeAfterImages
  );
  app.post(
    "/before-after/signed-url",
    AttendanceController.createBeforeAfterSignedUrl
  );
  app.post("/before-after", AttendanceController.saveBeforeAfterImage);
  app.patch("/before-after/:imageId", AttendanceController.updateAfterImage);
  app.delete(
    "/before-after/:imageId",
    AttendanceController.deleteBeforeAfterImage
  );
  app.get(
    "/before-after/:imageId/download",
    AttendanceController.downloadBeforeAfterImage
  );

  // Routes for documents (simplified)
  app.get("/documents/patient/:patientId", AttendanceController.listDocuments);
  app.post(
    "/documents/signed-url",
    AttendanceController.createDocumentSignedUrl
  );
  app.post("/documents", AttendanceController.saveDocument);
  app.delete("/documents/:documentId", AttendanceController.deleteDocument);
  app.get(
    "/documents/:documentId/download",
    AttendanceController.downloadDocument
  );

  app.get(
    "/documents/templates/:patientId",
    AttendanceController.getDocumentTemplates
  );
  app.post("/documents/generate", AttendanceController.generateDocument);

  app.put("/diagnosis/:appointmentId", AttendanceController.updateDiagnosis);
}
