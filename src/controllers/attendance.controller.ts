import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceService } from "../services/attendance.service";
import {
  saveDiagnosisSchema,
  createSignedUrlSchema,
  saveAttachmentSchema,
  attachmentParamsSchema,
  appointmentParamsSchema,
  patientParamsSchema,
  createBeforeAfterSignedUrlSchema,
  saveBeforeAfterSchema,
  beforeAfterParamsSchema,
  updateAfterImageSchema,
  documentParamsSchema,
  listDocumentsQuerySchema,
  createDocumentSignedUrlSchema,
  saveDocumentSchema,
  updateDiagnosisSchema,
  signDocumentBodySchema,
  generateDocumentSchema,
} from "../schemas/attendance.schema";
import z from "zod";

export class AttendanceController {
  static async getDocumentTemplates(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request;
    const { patientId } = patientParamsSchema.parse(request.params);
    const { type } = listDocumentsQuerySchema.parse(request.query);

    const templates = await AttendanceService.getTemplatesForPatient(
      patientId,
      type,
      clinicId
    );
    return reply.send(templates);
  }

  static async generateDocument(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    // Não pegamos mais o user.id aqui para definir o profissional

    // Parse do body usando o schema atualizado
    const { patientId, templateId, professionalId } =
      generateDocumentSchema.parse(request.body);

    const document = await AttendanceService.generateDocumentFromTemplate({
      patientId,
      templateId,
      clinicId,
      professionalId, // <--- Usa o ID que veio do Frontend (Select)
    });

    return reply.status(201).send(document);
  }

  static async getAttendanceData(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { clinicId } = request;

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
    const { clinicId } = request;

    // You might want to add a check to ensure the patient belongs to the clinic
    const attachments = await AttendanceService.listAttachments(patientId);
    return reply.send(attachments);
  }

  static async createSignedUploadUrl(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request;
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
    const { clinicId } = request;

    await AttendanceService.deleteAttachment(attachmentId, clinicId);
    return reply.status(204).send();
  }

  static async getBeforeAfterImages(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const images = await AttendanceService.getBeforeAfterImages(patientId);
    return reply.send(images);
  }

  static async createBeforeAfterSignedUrl(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request;
    const body = createBeforeAfterSignedUrlSchema.parse(request.body);

    const signedUrlData = await AttendanceService.createBeforeAfterSignedUrl({
      ...body,
      clinicId,
    });
    return reply.send(signedUrlData);
  }

  static async saveBeforeAfterImage(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const data = saveBeforeAfterSchema.parse(request.body);
    const image = await AttendanceService.saveBeforeAfterImage(data);
    return reply.status(201).send(image);
  }

  static async updateAfterImage(request: FastifyRequest, reply: FastifyReply) {
    const { imageId } = beforeAfterParamsSchema.parse(request.params);
    const { afterImagePath } = updateAfterImageSchema.parse(request.body);

    const updatedImage = await AttendanceService.updateAfterImage(
      imageId,
      afterImagePath
    );
    return reply.send(updatedImage);
  }

  static async deleteBeforeAfterImage(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { imageId } = beforeAfterParamsSchema.parse(request.params);
    const { clinicId } = request;

    await AttendanceService.deleteBeforeAfterImage(imageId, clinicId);
    return reply.status(204).send();
  }

  static async listDocuments(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const { type } = listDocumentsQuerySchema.parse(request.query);

    const documents = await AttendanceService.listDocuments(patientId, type);
    return reply.send(documents);
  }

  static async createDocumentSignedUrl(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request;
    const body = createDocumentSignedUrlSchema.parse(request.body);

    const signedUrlData = await AttendanceService.createDocumentSignedUrl({
      ...body,
      clinicId,
    });
    return reply.send(signedUrlData);
  }

  static async saveDocument(request: FastifyRequest, reply: FastifyReply) {
    const data = saveDocumentSchema.parse(request.body);

    const document = await AttendanceService.saveDocument(data);
    return reply.status(201).send(document);
  }

  static async deleteDocument(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { documentId } = documentParamsSchema.parse(request.params);

    await AttendanceService.deleteDocument(documentId, clinicId);
    return reply.status(204).send();
  }

  static async downloadDocument(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = documentParamsSchema.parse(request.params);
    const { clinicId } = request;

    const { signedUrl, fileName, fileType } =
      await AttendanceService.getDocumentDownloadUrl(documentId, clinicId);

    return reply.redirect(signedUrl, 302);
  }

  static async downloadAttachment(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { attachmentId } = attachmentParamsSchema.parse(request.params);
    const { clinicId } = request;

    const { signedUrl } = await AttendanceService.getAttachmentDownloadUrl(
      attachmentId,
      clinicId
    );

    return reply.redirect(signedUrl);
  }

  static async downloadBeforeAfterImage(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { imageId } = beforeAfterParamsSchema.parse(request.params);
    const { type } = z
      .object({ type: z.enum(["before", "after"]) })
      .parse(request.query);
    const { clinicId } = request;

    const { signedUrl } = await AttendanceService.getBeforeAfterDownloadUrl(
      imageId,
      type,
      clinicId
    );
    return reply.redirect(signedUrl);
  }

  static async updateDiagnosis(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { diagnosis } = updateDiagnosisSchema.parse(request.body);

    const clinicalRecord = await AttendanceService.saveDiagnosis(
      appointmentId,
      diagnosis
    );
    return reply.send(clinicalRecord);
  }

  static async signDocument(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = documentParamsSchema.parse(request.params);
    const { signature } = signDocumentBodySchema.parse(request.body);

    await AttendanceService.signDocument({
      documentId,
      signatureBase64: signature,
    });

    return reply
      .status(200)
      .send({ message: "Documento assinado com sucesso." });
  }
}
