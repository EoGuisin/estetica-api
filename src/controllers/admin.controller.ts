// src/controllers/admin.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { AdminService } from "../services/admin.service";
import { createTestAccountSchema } from "../schemas/admin.schema";

export class AdminController {
  // Função auxiliar para checar IP
  private static checkIpAccess(request: FastifyRequest) {
    const allowedIps = process.env.ALLOWED_ADMIN_IPS?.split(",") || [];
    const clientIp = request.ip;

    // Se a variável estiver vazia ou o IP não bater
    if (allowedIps.length === 0 || !allowedIps.includes(clientIp)) {
      return false;
    }
    return true;
  }

  static async createTestAccount(request: FastifyRequest, reply: FastifyReply) {
    if (!AdminController.checkIpAccess(request)) {
      return reply
        .status(403)
        .send({ message: "Acesso negado. IP não autorizado." });
    }

    try {
      const data = createTestAccountSchema.parse(request.body);
      const result = await AdminService.createTestAccount(data);
      return reply.status(201).send(result);
    } catch (error: any) {
      if (error.code === "CONFLICT") {
        return reply.status(409).send({ message: error.message });
      }
      throw error;
    }
  }

  static async wipeTestAccount(request: FastifyRequest, reply: FastifyReply) {
    if (!AdminController.checkIpAccess(request)) {
      return reply
        .status(403)
        .send({ message: "Acesso negado. IP não autorizado." });
    }

    try {
      const { accountId } = request.params as { accountId: string };
      const result = await AdminService.wipeTestAccount(accountId);
      return reply.send(result);
    } catch (error: any) {
      if (error.code === "NOT_FOUND") {
        return reply.status(404).send({ message: error.message });
      }
      throw error;
    }
  }
}
