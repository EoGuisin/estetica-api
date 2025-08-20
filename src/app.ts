// src/app.ts
import fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth.routes";

export const app = fastify();

// Configura o CORS
app.register(cors, {
  origin: "http://localhost:3000",
});

// Rota de Health Check
app.get("/", () => {
  return { message: "API de Estética está funcionando!" };
});

// Registra as rotas de autenticação
app.register(authRoutes, { prefix: "/auth" });

// Tratamento global de erros
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    // Se o erro for do Zod, retorna 400 com os detalhes
    return reply.status(400).send({
      message: "Erro de validação",
      issues: error.format(),
    });
  }

  // Para outros erros, logar e retornar um erro genérico
  console.error(error);
  return reply.status(500).send({ message: "Erro interno do servidor." });
});
