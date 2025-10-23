import { FastifyRequest, FastifyReply } from "fastify";
import { SpecialtyTemplateService } from "../services/specialtyTemplate.service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  templateParamsSchema,
  specialtyParamsSchema,
  listTemplatesQuerySchema,
} from "../schemas/specialtyTemplate.schema";
import { TEMPLATE_VARIABLES } from "../lib/templateVariables";

export class SpecialtyTemplateController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createTemplateSchema.parse(request.body);
    const template = await SpecialtyTemplateService.create(data);
    return reply.status(201).send(template);
  }

  static async findMany(request: FastifyRequest, reply: FastifyReply) {
    const { specialtyId } = specialtyParamsSchema.parse(request.params);
    const { type } = listTemplatesQuerySchema.parse(request.query);
    const templates = await SpecialtyTemplateService.findMany(
      specialtyId,
      type
    );
    return reply.send(templates);
  }

  static async findById(request: FastifyRequest, reply: FastifyReply) {
    const { templateId } = templateParamsSchema.parse(request.params);
    const template = await SpecialtyTemplateService.findById(templateId);
    return reply.send(template);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { templateId } = templateParamsSchema.parse(request.params);
    const data = updateTemplateSchema.parse(request.body);
    const template = await SpecialtyTemplateService.update(templateId, data);
    return reply.send(template);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { templateId } = templateParamsSchema.parse(request.params);
    await SpecialtyTemplateService.delete(templateId);
    return reply.status(204).send();
  }

  static async getVariables(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(TEMPLATE_VARIABLES);
  }
}
