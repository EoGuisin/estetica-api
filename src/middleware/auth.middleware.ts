// src/middleware/auth.middleware.ts
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import jwt from "jsonwebtoken";

// --- MUDANÇA AQUI ---
// O payload agora reflete o novo schema.
// roleId e clinicId podem ser nulos (para Donos)
interface UserPayload {
  userId: string;
  roleId: string | null;
  clinicId: string | null;
  accountId: string;
}

// Estende a interface do FastifyRequest
declare module "fastify" {
  interface FastifyRequest {
    user: UserPayload; // Payload bruto do token
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
    throw new Error("Chave secreta JWT não configurada no .env");
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return reply.status(401).send({ message: "Token inválido ou expirado." });
    }

    // --- MUDANÇA AQUI ---
    // Apenas anexa o payload decodificado.
    // NÃO tentamos adivinhar a clínica aqui.
    request.user = decoded as UserPayload;
    done();
  });
}
