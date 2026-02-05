import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";

interface DecodedUser {
  userId: string;
  accountId: string;
  clinicId?: string | null;
  roleId?: string;
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
  const user = request.user as unknown as DecodedUser;

  if (!user || !user.userId) {
    return reply
      .status(401)
      .send({ message: "Usuário não autenticado (ID inválido)." });
  }

  // 1. TENTA PEGAR DO HEADER PRIMEIRO (A escolha explícita do usuário)
  const clinicHeader = request.headers["x-clinic-id"] as string;

  if (clinicHeader) {
    // Validação básica de UUID
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        clinicHeader
      )
    ) {
      return reply
        .status(400)
        .send({ message: "Header X-Clinic-Id inválido." });
    }

    // VERIFICAÇÃO DE SEGURANÇA:
    // O usuário realmente pode acessar essa clínica do header?
    const clinic = await prisma.clinic.findFirst({
      where: {
        id: clinicHeader,
        OR: [
          { account: { ownerId: user.userId } }, // É dono da conta
          { users: { some: { id: user.userId } } }, // Ou é funcionário vinculado
        ],
      },
      select: { id: true },
    });

    if (!clinic) {
      return reply
        .status(403)
        .send({ message: "Acesso negado a esta clínica." });
    }

    // SE PASSOU, USA O HEADER
    request.clinicId = clinic.id;
    return;
  }

  // 2. FALLBACK: SE NÃO VEIO HEADER, TENTA USAR O DO TOKEN (Legado/Single Clinic)
  if (user.clinicId) {
    request.clinicId = user.clinicId;
    return;
  }

  return reply.status(400).send({ message: "Clínica não selecionada." });
}
