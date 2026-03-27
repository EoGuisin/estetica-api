import { FastifyRequest, FastifyReply } from "fastify";
import { TicketService } from "../services/ticket.service";
import {
  createTicketSchema,
  addTicketMessageSchema,
} from "../schemas/ticket.schema";

interface DecodedUser {
  userId: string;
  accountId: string;
  clinicId: string;
  isSystemOwner?: boolean;
  role?: { name: string; type: string };
}

export class TicketController {
  static async createTicket(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as unknown as DecodedUser;
    const clinicId =
      user.clinicId || (request.headers["x-clinic-id"] as string);

    const data = createTicketSchema.parse(request.body);
    const newTicket = await TicketService.createTicket(
      clinicId,
      user.userId,
      data
    );

    return reply.status(201).send(newTicket);
  }

  static async listTickets(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as unknown as DecodedUser;
    const clinicId =
      user.clinicId || (request.headers["x-clinic-id"] as string);

    const tickets = await TicketService.listTickets(clinicId);
    return reply.send(tickets);
  }

  static async getTicketById(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as unknown as DecodedUser;
    const clinicId =
      user.clinicId || (request.headers["x-clinic-id"] as string);
    const { id } = request.params as { id: string };

    try {
      const ticket = await TicketService.getTicketById(
        clinicId,
        id,
        user.userId,
        user.role?.type
      );
      return reply.send(ticket);
    } catch (error: any) {
      if (error.code === "NOT_FOUND")
        return reply.status(404).send({ message: error.message });
      throw error;
    }
  }

  static async addMessage(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as unknown as DecodedUser;
    const clinicId =
      user.clinicId || (request.headers["x-clinic-id"] as string);
    const { id } = request.params as { id: string };

    try {
      const data = addTicketMessageSchema.parse(request.body);
      const message = await TicketService.addMessage(
        clinicId,
        id,
        user.userId,
        data
      );
      return reply.status(201).send(message);
    } catch (error: any) {
      if (error.code === "NOT_FOUND")
        return reply.status(404).send({ message: error.message });
      throw error;
    }
  }

  // TELA DO SUPER ADMIN (Visão de Deus)
  static async listAllSystemTickets(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = request.user as unknown as DecodedUser;

    // Agora validamos direto na coluna raiz do usuário! Muito mais seguro.
    if (!user.isSystemOwner) {
      return reply.status(403).send({
        message:
          "Acesso negado. Área restrita aos administradores da plataforma.",
      });
    }

    const tickets = await TicketService.listAllSystemTickets();
    return reply.send(tickets);
  }

  static async getAdminTicketById(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const user = request.user as any;
    if (!user.isSystemOwner)
      return reply.status(403).send({ message: "Acesso negado." });

    const { id } = request.params as { id: string };
    const ticket = await TicketService.getAdminTicketById(id);
    return reply.send(ticket);
  }

  static async addAdminMessage(request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as any;
    if (!user.isSystemOwner)
      return reply.status(403).send({ message: "Acesso negado." });

    const { id } = request.params as { id: string };
    const data = addTicketMessageSchema.parse(request.body);
    const message = await TicketService.addAdminMessage(id, user.userId, data);
    return reply.status(201).send(message);
  }
}
