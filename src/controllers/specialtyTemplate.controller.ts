import { FastifyRequest, FastifyReply } from "fastify";
import { SpecialtyTemplateService } from "../services/specialtyTemplate.service";
import {
  createTemplateSchema,
  updateTemplateSchema,
} from "../schemas/specialtyTemplate.schema";
import { DocumentType } from "@prisma/client";
import { TEMPLATE_VARIABLES } from "../lib/templateVariables";

export class SpecialtyTemplateController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA O ID DA CLÍNICA
    const data = createTemplateSchema.parse(request.body);

    const template = await SpecialtyTemplateService.create(data, clinicId);
    return reply.status(201).send(template);
  }

  static async listBySpecialty(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA O ID DA CLÍNICA
    const { specialtyId } = request.params as { specialtyId: string };
    const { type } = request.query as { type?: DocumentType };

    const templates = await SpecialtyTemplateService.findMany(
      specialtyId,
      clinicId, // <--- Passa o clinicId
      type
    );
    return reply.send(templates);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    const template = await SpecialtyTemplateService.findById(id, clinicId);
    return reply.send(template);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updateTemplateSchema.parse(request.body);

    const template = await SpecialtyTemplateService.update(id, data, clinicId);
    return reply.send(template);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string }; // No seu código estava 'templateId' na rota? Confirme.
    // A rota é: app.delete("/:templateId", ...) -> então params é { templateId: string }
    // SE O NOME NA ROTA FOR :templateId, use templateId aqui. Se for :id, use id.

    // Vou assumir que na rota está app.delete("/:id") ou o controller ajusta.
    // Se sua rota é app.delete("/:templateId"), o controller deve ser:
    // const { templateId } = request.params as { templateId: string };

    try {
      // Se na rota for /:templateId, mude 'id' para 'templateId'
      await SpecialtyTemplateService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      // Captura o erro de "Template em uso"
      if (error.message.includes("não pode ser excluído")) {
        return reply.status(400).send({ message: error.message });
      }
      throw error;
    }
  }

  static async getVariables(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(TEMPLATE_VARIABLES);
  }
}
