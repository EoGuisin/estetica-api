// src/controllers/specialty.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { SpecialtyService } from "../services/specialty.service";
import { specialtySchema } from "../schemas/specialty.schema";

export class SpecialtyController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const specialties = await SpecialtyService.list();
    return reply.send(specialties);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const specialty = await SpecialtyService.getById(id);
    return reply.send(specialty);
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = specialtySchema.parse(request.body);
    const specialty = await SpecialtyService.create(data);
    return reply.status(201).send(specialty);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = specialtySchema.parse(request.body);
    const specialty = await SpecialtyService.update(id, data);
    return reply.send(specialty);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await SpecialtyService.delete(id);
    return reply.status(204).send();
  }
}
