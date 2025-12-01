// src/middleware/clinic-access.middleware.ts
import { FastifyRequest, FastifyReply } from "fastify"; // Removi o HookHandlerDoneFunction
import { prisma } from "../lib/prisma";

// Estende a interface do FastifyRequest para adicionar o clinicId EFETIVO
declare module "fastify" {
  interface FastifyRequest {
    clinicId: string;
  }
}

/**
 * Este middleware DEVE ser executado DEPOIS do 'authMiddleware'.
 * Ele usa ASYNC/AWAIT, portanto não deve receber o parâmetro 'done'.
 */
export async function clinicAccessMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
  // REMOVIDO: done
) {
  const user = request.user; // Injetado pelo authMiddleware

  if (user.clinicId) {
    // --- Caminho 1: É um FUNCIONÁRIO ---
    request.clinicId = user.clinicId;
    return; // Apenas retorna (resolve a Promise automaticamente)
  }

  // --- Caminho 2: É um DONO ---
  const clinicHeader = request.headers["x-clinic-id"] as string | undefined;

  if (!clinicHeader) {
    return reply.status(400).send({
      message:
        "Proprietários devem fornecer o header 'X-Clinic-Id' para especificar a clínica.",
    });
  }

  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      clinicHeader
    )
  ) {
    return reply.status(400).send({ message: "Header X-Clinic-Id inválido." });
  }

  try {
    const clinic = await prisma.clinic.findFirst({
      where: {
        id: clinicHeader,
        accountId: user.accountId,
      },
      select: { id: true },
    });

    if (!clinic) {
      return reply
        .status(403)
        .send({ message: "Acesso negado a esta clínica." });
    }

    // Sucesso! Injeta o clinicId na requisição
    request.clinicId = clinic.id;
    return; // Sucesso
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Erro ao verificar acesso à clínica." });
  }
}