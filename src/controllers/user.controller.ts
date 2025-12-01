// src/controllers/user.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { UserService } from "../services/user.service";
import { createUserSchema, updateUserSchema } from "../schemas/user.schema";

export class UserController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const data = createUserSchema.parse(request.body);
    const user = await UserService.create(clinicId, data);
    return reply.status(201).send(user);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const {
      page = "1",
      pageSize = "10",
      name,
      document,
    } = request.query as any;
    const result = await UserService.list(
      clinicId,
      Number.parseInt(page),
      Number.parseInt(pageSize),
      name,
      document
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const user = await UserService.getById(id);
    return reply.send(user);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = updateUserSchema.parse(request.body);
    const user = await UserService.update(id, data);
    return reply.send(user);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    await UserService.delete(id, clinicId);
    return reply.status(204).send();
  }
}
