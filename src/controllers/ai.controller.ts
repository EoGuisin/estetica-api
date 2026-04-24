import { FastifyRequest, FastifyReply } from "fastify";
import { AiService } from "../services/ai.service";

export class AiController {
  static async ask(request: FastifyRequest, reply: FastifyReply) {
    const { message } = request.body as { message: string };

    if (!message) {
      return reply.status(400).send({ error: "A mensagem é obrigatória." });
    }

    const answer = await AiService.answerQuestion(message);

    // Retornamos em formato JSON para facilitar a integração no front
    return reply.send({ text: answer });
  }
}
