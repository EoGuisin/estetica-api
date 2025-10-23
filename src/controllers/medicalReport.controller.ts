import { FastifyRequest, FastifyReply } from "fastify";
import { MedicalReportService } from "../services/medicalReport.service";
import {
  createReportSchema,
  updateReportSchema,
  reportParamsSchema,
  patientParamsSchema,
} from "../schemas/medicalReport.schema";

export class MedicalReportController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    // FIX: Use request.user.userId which comes from the auth token payload
    const professionalId = request.user.userId;

    // FIX: Cast request.body to object to avoid spread type errors
    const data = createReportSchema.parse({
      ...(request.body as object),
      professionalId,
    });

    const report = await MedicalReportService.create(data);
    return reply.status(201).send(report);
  }

  static async findByPatientId(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const reports = await MedicalReportService.findByPatientId(patientId);
    return reply.send(reports);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { reportId } = reportParamsSchema.parse(request.params);
    const data = updateReportSchema.parse(request.body);
    const report = await MedicalReportService.update(reportId, data);
    return reply.send(report);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { reportId } = reportParamsSchema.parse(request.params);
    await MedicalReportService.delete(reportId);
    return reply.status(204).send();
  }

  static async downloadPdf(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { reportId } = reportParamsSchema.parse(request.params);
    const pdfBuffer = await MedicalReportService.generatePdf(
      reportId,
      clinicId
    );

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="laudo-${reportId}.pdf"`
    );
    return reply.send(pdfBuffer);
  }
}
