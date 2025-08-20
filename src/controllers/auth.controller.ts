import { FastifyRequest, FastifyReply } from "fastify";
import { loginSchema } from "../schemas/auth.schema";
import { AuthService } from "../services/auth.service";

export class AuthController {
  static async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Valida o corpo da requisição com Zod
      const data = loginSchema.parse(request.body);

      // Chama o serviço para executar a lógica
      const result = await AuthService.login(data);

      return reply.status(200).send(result);
    } catch (error) {
      // Se o serviço lançar um erro (ex: senha inválida), retorna 401
      if (error instanceof Error && error.message.includes("inválidos")) {
        return reply.status(401).send({ message: error.message });
      }
      // Deixa o handler global cuidar de outros erros (como ZodError)
      throw error;
    }
  }
}
