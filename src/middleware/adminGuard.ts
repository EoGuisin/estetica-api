import { FastifyReply, FastifyRequest } from "fastify";

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers["x-admin-token"];
  const masterKey = process.env.ADMIN_MASTER_KEY;

  // LOG DE SEGURANÇA (Aparecerá no terminal do seu VS Code)
  console.log(`[AUTH CHECK] Recebido: ${token} | Esperado: ${masterKey}`);

  if (!token || token !== masterKey) {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Chave mestra inválida ou ausente.",
    });
  }
  // Se chegar aqui, ele libera a rota
}
