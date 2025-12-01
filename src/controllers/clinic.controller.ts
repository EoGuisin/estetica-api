import { FastifyRequest, FastifyReply } from "fastify";
import { ClinicService } from "../services/clinic.service";
import {
  createClinicSchema,
  updateClinicSchema,
} from "../schemas/clinic.schema";

export class ClinicController {
  // ... (create existente)

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user;
    const data = createClinicSchema.parse(request.body);

    const clinic = await ClinicService.create(userId, data);
    return reply.status(201).send(clinic);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user; // Dono
    const { id } = request.params as { id: string };
    const data = updateClinicSchema.parse(request.body);

    const clinic = await ClinicService.update(id, userId, data);
    return reply.send(clinic);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user;
    const { id } = request.params as { id: string };

    await ClinicService.delete(id, userId);
    return reply.status(204).send();
  }
}
