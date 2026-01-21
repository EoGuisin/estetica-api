// src/middleware/roleGuard.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";

type RoleType = "ADMIN" | "COMMERCIAL" | "SECRETARY" | "PROFESSIONAL";

export function roleGuard(allowedRoles: RoleType[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user; // Injetado pelo authMiddleware

    /**
     * REGRA DE OURO PARA O PROPRIETÁRIO:
     * Se o usuário não tem clinicId vinculado diretamente no perfil,
     * ele é o dono da conta (Account Owner). Liberdade total.
     */
    if (!user.clinicId) {
      return;
    }

    try {
      // Busca o papel do funcionário para validar a permissão
      const userWithRole = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          role: {
            select: { type: true },
          },
        },
      });

      const userRoleType = userWithRole?.role?.type as RoleType | undefined;

      // Se o cargo não for um dos permitidos para esta rota, bloqueia
      if (!userRoleType || !allowedRoles.includes(userRoleType)) {
        return reply.status(403).send({
          message:
            "Acesso Negado: Seu cargo não tem permissão para este recurso.",
        });
      }
    } catch (error) {
      return reply.status(500).send({ message: "Erro ao validar permissões." });
    }
  };
}
