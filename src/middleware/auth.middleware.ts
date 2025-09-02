// src/middleware/auth.middleware.ts
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import jwt from "jsonwebtoken";

interface UserPayload {
  userId: string;
  roleId: string;
  clinicId: string;
}

// Estende a interface do FastifyRequest para incluir nosso payload 'user'
declare module "fastify" {
  interface FastifyRequest {
    user: UserPayload;
  }
}

export function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply
      .status(401)
      .send({ message: "Token de autenticação não fornecido." });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2) {
    return reply.status(401).send({ message: "Erro no formato do token." });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return reply.status(401).send({ message: "Token mal formatado." });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Este erro é para o desenvolvedor, não para o usuário final
    throw new Error("Chave secreta JWT não configurada no .env");
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return reply.status(401).send({ message: "Token inválido ou expirado." });
    }

    // Anexa o payload decodificado ao objeto de requisição
    request.user = decoded as UserPayload;
    done();
  });
}
