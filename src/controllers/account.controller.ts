// src/controllers/account.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { AccountService } from "../services/account.service";
import { createClinicSchema } from "../schemas/account.schema";

export class AccountController {
  static async getStats(request: FastifyRequest, reply: FastifyReply) {
    const { accountId } = request.user;
    const stats = await AccountService.getStats(accountId);
    return reply.send(stats);
  }

  static async listClinics(request: FastifyRequest, reply: FastifyReply) {
    const { accountId } = request.user;
    const clinics = await AccountService.listClinics(accountId);
    return reply.send(clinics);
  }

  // --- CORREÇÃO AQUI ---
  // O Controller recebe (request, reply), extrai o ID e chama o Service
  static async getSubscription(request: FastifyRequest, reply: FastifyReply) {
    const { accountId } = request.user;

    // Agora passamos uma string limpa para o service
    const subscription = await AccountService.getSubscription(accountId);

    return reply.send(subscription);
  }

  static async createClinic(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { accountId } = request.user;
      const data = createClinicSchema.parse(request.body);
      const newClinic = await AccountService.createClinic(accountId, data);
      return reply.status(201).send(newClinic);
    } catch (error: any) {
      if (error.code === "CONFLICT") {
        return reply.status(409).send({ message: error.message });
      }
      if (error.code === "PAYMENT_REQUIRED") {
        return reply.status(402).send({ message: error.message });
      }
      if (error.code === "FORBIDDEN") {
        return reply.status(403).send({ message: error.message });
      }
      throw error;
    }
  }
}
