import { FastifyRequest, FastifyReply } from "fastify";
import { DashboardService } from "../services/dashboard.service";

// Interface para garantir a tipagem do user
interface DecodedUser {
  userId: string;
  accountId: string;
}

export class DashboardController {
  static async getProfessionals(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const user = request.user as unknown as DecodedUser;

    // Passamos o ID do usuário que está chamando a rota
    const professionals = await DashboardService.getProfessionals(
      clinicId,
      user.userId
    );

    return reply.send(professionals);
  }

  static async getAppointments(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const user = request.user as unknown as DecodedUser;

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

    const professionalIds = professionals?.split(",").filter((id) => id);

    // Passamos o ID do usuário logado para filtrar agendamentos se necessário
    const appointments = await DashboardService.getAppointments(
      clinicId,
      user.userId, // <--- NOVO
      new Date(start),
      new Date(end),
      professionalIds
    );

    return reply.send(appointments);
  }
}
