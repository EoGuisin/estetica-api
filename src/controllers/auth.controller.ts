import { FastifyRequest, FastifyReply } from "fastify";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema";
import { AuthService } from "../services/auth.service";

export class AuthController {
  static async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = loginSchema.parse(request.body);
      const result = await AuthService.login(data);
      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.code === "UNAUTHORIZED") {
        return reply.status(401).send({ message: error.message });
      }
      throw error;
    }
  }

  static async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = registerSchema.parse(request.body);
      const result = await AuthService.register(data);
      return reply.status(201).send(result);
    } catch (error: any) {
      if (error.code === "CONFLICT") {
        return reply.status(409).send({ message: error.message });
      }
      throw error;
    }
  }

  static async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = forgotPasswordSchema.parse(request.body);
      const result = await AuthService.forgotPassword(data);
      return reply.status(200).send(result);
    } catch (error) {
      throw error;
    }
  }

  static async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = resetPasswordSchema.parse(request.body);
      const result = await AuthService.resetPassword(data);
      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.code === "NOT_FOUND")
        return reply.status(404).send({ message: error.message });
      if (error.code === "GONE")
        return reply.status(410).send({ message: error.message });
      throw error;
    }
  }
}
