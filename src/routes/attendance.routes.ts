import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AttendanceController } from "../controllers/attendance.controller";

export async function attendanceRoutes(app: FastifyInstance) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", authMiddleware);

    // Main route for the attendance page
    protectedRoutes.get(
      "/:appointmentId",
      AttendanceController.getAttendanceData
    );
    protectedRoutes.put("/:appointmentId", AttendanceController.saveDiagnosis);

    // Routes for attachments
    protectedRoutes.get(
      "/attachments/patient/:patientId",
      AttendanceController.listAttachments
    );
    protectedRoutes.post(
      "/attachments/signed-url",
      AttendanceController.createSignedUploadUrl
    );
    protectedRoutes.post("/attachments", AttendanceController.saveAttachment);
    protectedRoutes.delete(
      "/attachments/:attachmentId",
      AttendanceController.deleteAttachment
    );
    protectedRoutes.get(
      "/attachments/:attachmentId/download",
      AttendanceController.downloadAttachment
    );

    // Routes for before/after images
    protectedRoutes.get(
      "/before-after/:patientId",
      AttendanceController.getBeforeAfterImages
    );
    protectedRoutes.post(
      "/before-after/signed-url",
      AttendanceController.createBeforeAfterSignedUrl
    );
    protectedRoutes.post(
      "/before-after",
      AttendanceController.saveBeforeAfterImage
    );
    protectedRoutes.patch(
      "/before-after/:imageId",
      AttendanceController.updateAfterImage
    );
    protectedRoutes.delete(
      "/before-after/:imageId",
      AttendanceController.deleteBeforeAfterImage
    );
    protectedRoutes.get(
      "/before-after/:imageId/download",
      AttendanceController.downloadBeforeAfterImage
    );

    // Routes for documents (simplified)
    protectedRoutes.get(
      "/documents/patient/:patientId",
      AttendanceController.listDocuments
    );
    protectedRoutes.post(
      "/documents/signed-url",
      AttendanceController.createDocumentSignedUrl
    );
    protectedRoutes.post("/documents", AttendanceController.saveDocument);
    protectedRoutes.delete(
      "/documents/:documentId",
      AttendanceController.deleteDocument
    );
    protectedRoutes.get(
      "/documents/:documentId/download",
      AttendanceController.downloadDocument
    );

    protectedRoutes.get(
      "/documents/templates/:patientId",
      AttendanceController.getDocumentTemplates
    );
    protectedRoutes.post(
      "/documents/generate",
      AttendanceController.generateDocument
    );

    protectedRoutes.put(
      "/diagnosis/:appointmentId",
      AttendanceController.updateDiagnosis
    );
  });
}
