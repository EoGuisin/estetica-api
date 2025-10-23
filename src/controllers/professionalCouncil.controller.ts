import { FastifyRequest, FastifyReply } from "fastify";
import { ProfessionalCouncilService } from "../services/professionalCouncil.service";
import {
  createProfessionalCouncilSchema,
  updateProfessionalCouncilSchema,
} from "../schemas/professionalCouncil.schema";

export class ProfessionalCouncilController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createProfessionalCouncilSchema.parse(request.body);
      const council = await ProfessionalCouncilService.create(data);
      return reply.status(201).send(council);
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target.includes("name")) {
        return reply
          .status(409)
          .send({ message: "Um conselho com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const {
      page = "1",
      pageSize = "10",
      name,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
    };

    const pageNumber = Number.parseInt(page, 10);
    const pageSizeNumber = Number.parseInt(pageSize, 10);

    const result = await ProfessionalCouncilService.list(
      pageNumber,
      pageSizeNumber,
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const council = await ProfessionalCouncilService.getById(id);
    if (!council) {
      return reply
        .status(404)
        .send({ message: "Conselho profissional não encontrado." });
    }
    return reply.send(council);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = updateProfessionalCouncilSchema.parse(request.body);
    const council = await ProfessionalCouncilService.update(id, data);
    return reply.send(council);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await ProfessionalCouncilService.delete(id);
    return reply.status(204).send();
  }
}
