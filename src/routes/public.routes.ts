import { FastifyInstance } from "fastify";
import { AttendanceController } from "../controllers/attendance.controller";

export async function publicRoutes(app: FastifyInstance) {
  app.post(
    "/attendance/documents/:documentId/sign",
    AttendanceController.signDocument
  );
}
