import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";

// 1. CORREÇÃO: Ajustamos a interface para bater com o AuthMiddleware (userId)
interface DecodedUser {
  userId: string; // ERA 'id', MUDAMOS PARA 'userId'
  accountId: string;
  clinicId?: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    clinicId: string;
  }
}

export async function clinicAccessMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Cast para a interface corrigida
  const user = request.user as unknown as DecodedUser;

  // 2. CORREÇÃO: Validamos 'userId' em vez de 'id'
  if (!user || !user.userId) {
    return reply
      .status(401)
      .send({ message: "Usuário não autenticado (ID inválido)." });
  }

  if (user.clinicId) {
    request.clinicId = user.clinicId;
    return;
  }

  const clinicHeader = request.headers["x-clinic-id"] as string;

  if (!clinicHeader) {
    return reply.status(400).send({ message: "Clínica não selecionada." });
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
        OR: [
          // 3. CORREÇÃO: Usamos 'user.userId' nas queries do Prisma
          { account: { ownerId: user.userId } },
          { users: { some: { id: user.userId } } },
        ],
      },
      select: { id: true },
    });

    if (!clinic) {
      return reply
        .status(403)
        .send({ message: "Acesso negado a esta clínica." });
    }

    request.clinicId = clinic.id;
    return;
  } catch (error) {
    console.error("Erro no middleware de acesso:", error);
    return reply.status(500).send({ message: "Erro ao verificar acesso." });
  }
}
