import { FastifyRequest, FastifyReply } from "fastify";
import { PrescriptionService } from "../services/prescription.service";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  prescriptionParamsSchema,
  patientParamsSchema,
} from "../schemas/prescription.schema";

export class PrescriptionController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    // FIX: Use request.user.userId which comes from the auth token payload
    const professionalId = request.user.userId;

    // FIX: Cast request.body to object to avoid spread type errors
    const data = createPrescriptionSchema.parse({
      ...(request.body as object),
      professionalId,
    });

    const prescription = await PrescriptionService.create(data);
    return reply.status(201).send(prescription);
  }

  static async findByPatientId(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const prescriptions = await PrescriptionService.findByPatientId(patientId);
    return reply.send(prescriptions);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { prescriptionId } = prescriptionParamsSchema.parse(request.params);
    const data = updatePrescriptionSchema.parse(request.body);
    const prescription = await PrescriptionService.update(prescriptionId, data);
    return reply.send(prescription);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { prescriptionId } = prescriptionParamsSchema.parse(request.params);
    await PrescriptionService.delete(prescriptionId);
    return reply.status(204).send();
  }

  static async downloadPdf(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { prescriptionId } = prescriptionParamsSchema.parse(request.params);
    const pdfBuffer = await PrescriptionService.generatePdf(
      prescriptionId,
      clinicId
    );

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="receita-${prescriptionId}.pdf"`
    );
    return reply.send(pdfBuffer);
  }
}
