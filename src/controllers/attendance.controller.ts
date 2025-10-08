import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceService } from "../services/attendance.service";
import {
  saveDiagnosisSchema,
  createSignedUrlSchema,
  saveAttachmentSchema,
  attachmentParamsSchema,
  appointmentParamsSchema,
  patientParamsSchema,
} from "../schemas/attendance.schema";

export class AttendanceController {
  static async getAttendanceData(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    const data = await AttendanceService.getAttendanceData(
      appointmentId,
      clinicId
    );
    return reply.send(data);
  }

  static async saveDiagnosis(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { diagnosis } = saveDiagnosisSchema.parse(request.body);

    const record = await AttendanceService.saveDiagnosis(
      appointmentId,
      diagnosis
    );
    return reply.send(record);
  }

  static async listAttachments(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    // You might want to add a check to ensure the patient belongs to the clinic
    const attachments = await AttendanceService.listAttachments(patientId);
    return reply.send(attachments);
  }

  static async createSignedUploadUrl(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request.user;
    const body = createSignedUrlSchema.parse(request.body);

    const signedUrlData = await AttendanceService.createSignedUploadUrl({
      ...body,
      clinicId,
    });
    return reply.send(signedUrlData);
  }

  static async saveAttachment(request: FastifyRequest, reply: FastifyReply) {
    const data = saveAttachmentSchema.parse(request.body);

    const attachment = await AttendanceService.saveAttachment(data);
    return reply.status(201).send(attachment);
  }

  static async deleteAttachment(request: FastifyRequest, reply: FastifyReply) {
    const { attachmentId } = attachmentParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    await AttendanceService.deleteAttachment(attachmentId, clinicId);
    return reply.status(204).send();
  }
}
