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
    try {
      const { userId } = request.user;
      const { id } = request.params as { id: string };
      const data = updateClinicSchema.parse(request.body);

      const clinic = await ClinicService.update(id, userId, data);
      return reply.send(clinic);
    } catch (error: any) {
      if (error.isConflictError) {
        return reply.status(409).send({
          message: error.message,
          code: "HOURS_CONFLICT",
          conflicts: error.conflicts,
        });
      }

      // Erros genéricos
      throw error;
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user;
    const { id } = request.params as { id: string };

    await ClinicService.delete(id, userId);
    return reply.status(204).send();
  }

  static async getCurrentSettings(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request; // Middleware injetou o ID aqui

    if (!clinicId) {
      return reply
        .status(400)
        .send({ message: "Contexto de clínica não identificado." });
    }

    const clinic = await ClinicService.getById(clinicId);
    return reply.send(clinic);
  }
}
