// src/middleware/roleGuard.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";

type RoleType = "ADMIN" | "COMMERCIAL" | "SECRETARY" | "PROFESSIONAL";

// Interface local para tipagem (igual ao clinic-access)
interface DecodedUser {
  userId: string;
  accountId: string;
  clinicId?: string | null;
}

export function roleGuard(allowedRoles: RoleType[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as unknown as DecodedUser; // Cast seguro

    if (!user || !user.userId) {
      return reply.status(401).send({ message: "Usuário não autenticado." });
    }

    try {
      // Busca o usuário, o papel e verifica se ele é dono de alguma conta
      const userDb = await prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          role: {
            select: { type: true },
          },
          ownedAccount: {
            select: { id: true }, // Se existir, ele é dono
          },
        },
      });

      if (!userDb) {
        return reply.status(401).send({ message: "Usuário não encontrado." });
      }

      /**
       * REGRA DE OURO PARA O PROPRIETÁRIO:
       * Se o usuário possui um registro em 'ownedAccount', ele é o dono.
       * O Dono tem permissão total (ADMIN implícito), então ignoramos a checagem de array.
       */
      if (userDb.ownedAccount) {
        return; // Acesso liberado
      }

      const userRoleType = userDb.role?.type as RoleType | undefined;

      // Se não tem papel definido ou o papel não está na lista permitida
      if (!userRoleType || !allowedRoles.includes(userRoleType)) {
        return reply.status(403).send({
          message:
            "Acesso Negado: Seu cargo não tem permissão para este recurso.",
        });
      }
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ message: "Erro ao validar permissões." });
    }
  };
}
