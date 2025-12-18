import { FastifyRequest, FastifyReply } from "fastify";
import { SpecialtyService } from "../services/specialty.service";
import { specialtySchema } from "../schemas/specialty.schema";

export class SpecialtyController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA ID DA CLÍNICA
    const specialties = await SpecialtyService.list(clinicId);
    return reply.send(specialties);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA ID DA CLÍNICA
    const { id } = request.params as { id: string };

    const specialty = await SpecialtyService.getById(id, clinicId);

    if (!specialty) {
      return reply
        .status(404)
        .send({ message: "Especialidade não encontrada." });
    }
    return reply.send(specialty);
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA ID DA CLÍNICA
    const data = specialtySchema.parse(request.body);

    const specialty = await SpecialtyService.create(data, clinicId);
    return reply.status(201).send(specialty);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA ID DA CLÍNICA
    const { id } = request.params as { id: string };
    const data = specialtySchema.parse(request.body);

    const specialty = await SpecialtyService.update(id, data, clinicId);
    return reply.send(specialty);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA ID DA CLÍNICA
    const { id } = request.params as { id: string };

    await SpecialtyService.delete(id, clinicId);
    return reply.status(204).send();
  }
}
