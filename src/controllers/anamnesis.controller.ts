import { FastifyRequest, FastifyReply } from "fastify";
import { AnamnesisService } from "../services/anamnesis.service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  createAssessmentSchema,
} from "../schemas/anamnesis.schema";

export class AnamnesisController {
  static async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const data = createTemplateSchema.parse(request.body);
    const template = await AnamnesisService.createTemplate(clinicId, data);
    return reply.status(201).send(template);
  }

  static async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const templates = await AnamnesisService.listTemplates(clinicId);
    return reply.send(templates);
  }

  static async getTemplateById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const template = await AnamnesisService.getTemplateById(id, clinicId);
    if (!template) {
      return reply.status(404).send({ message: "Template não encontrado." });
    }
    return reply.send(template);
  }

  static async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updateTemplateSchema.parse(request.body);
    const template = await AnamnesisService.updateTemplate(id, clinicId, data);
    return reply.send(template);
  }

  static async deleteTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    await AnamnesisService.deleteTemplate(id, clinicId);
    return reply.status(204).send();
  }

  static async duplicateTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const newTemplate = await AnamnesisService.duplicateTemplate(id, clinicId);
    return reply.status(201).send(newTemplate);
  }

  static async createOrUpdateAssessment(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { userId } = request.user;
    const { clinicId } = request; // Já estava correto
    const { appointmentId } = request.params as { appointmentId: string };
    const data = createAssessmentSchema.parse(request.body);
    const assessment = await AnamnesisService.createOrUpdateAssessment(
      appointmentId,
      userId,
      clinicId,
      data
    );
    return reply.status(201).send(assessment);
  }

  static async getAssessmentByAppointment(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request; // ADICIONADO
    const { appointmentId } = request.params as { appointmentId: string };
    const assessmentData = await AnamnesisService.getAssessmentByAppointment(
      appointmentId,
      clinicId // PASSADO PARA O SERVICE
    );
    return reply.send(assessmentData);
  }

  static async listPatientAssessments(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request; // ADICIONADO
    const { patientId } = request.params as { patientId: string };
    const assessments = await AnamnesisService.listPatientAssessments(
      patientId,
      clinicId // PASSADO PARA O SERVICE
    );
    return reply.send(assessments);
  }

  static async getAssessmentById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // ADICIONADO
    const { id } = request.params as { id: string };
    const assessment = await AnamnesisService.getAssessmentById(id, clinicId); // PASSADO PARA O SERVICE
    if (!assessment) {
      return reply.status(404).send({ message: "Avaliação não encontrada." });
    }
    return reply.send(assessment);
  }
}
