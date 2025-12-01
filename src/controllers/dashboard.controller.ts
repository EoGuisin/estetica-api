// src/controllers/dashboard.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { DashboardService } from "../services/dashboard.service";

export class DashboardController {
  static async getProfessionals(request: FastifyRequest, reply: FastifyReply) {
    // Agora 'request.user' existe e está tipado graças ao middleware
    const { clinicId } = request;
    const professionals = await DashboardService.getProfessionals(clinicId);
    return reply.send(professionals);
  }

  static async getAppointments(request: FastifyRequest, reply: FastifyReply) {
    // O mesmo aqui, 'clinicId' é obtido de forma segura
    const { clinicId } = request;
    const { start, end, professionals } = request.query as {
      start: string;
      end: string;
      professionals?: string;
    };

    if (!start || !end) {
      return reply
        .status(400)
        .send({ message: "As datas de início e fim são obrigatórias." });
    }

    const professionalIds = professionals?.split(",").filter(id => id); // Garante que não haja strings vazias

    const appointments = await DashboardService.getAppointments(
      clinicId,
      new Date(start),
      new Date(end),
      professionalIds
    );
    return reply.send(appointments);
  }
}