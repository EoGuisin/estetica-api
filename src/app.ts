// src/app.ts
import fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { authRoutes } from "./routes/auth.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { appointmentRoutes } from "./routes/appointment.routes";
import { catalogRoutes } from "./routes/catalog.routes";
import { patientRoutes } from "./routes/patient.routes";
import { userRoutes } from "./routes/user.routes";
import { specialtyRoutes } from "./routes/specialty.routes";
import { treatmentPlanRoutes } from "./routes/treatmentPlan.routes";

// CORREÇÃO: Adicione a opção 'bodyLimit' ao criar o app
export const app = fastify({
  bodyLimit: 5 * 1024 * 1024, // 5 MB de limite para o corpo da requisição
});

// Configura o CORS
app.register(cors, {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
});

// Rota de Health Check
app.get("/", () => {
  return { message: "API de Estética está funcionando!" };
});

// Registra as rotas
app.register(authRoutes, { prefix: "/auth" });
app.register(dashboardRoutes, { prefix: "/dashboard" });
app.register(appointmentRoutes, { prefix: "/appointments" });
app.register(catalogRoutes, { prefix: "/catalogs" });
app.register(patientRoutes, { prefix: "/patients" });
app.register(userRoutes, { prefix: "/users" });
app.register(specialtyRoutes, { prefix: "/specialties" });
app.register(treatmentPlanRoutes, { prefix: "/treatment-plans" });

app.setErrorHandler((error, request, reply) => {
  if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return reply.status(413).send({
      message: "Erro de validação",
      issues: {
        _errors: ["A imagem enviada é muito grande. O limite é de 5MB."],
      },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Erro de validação",
      issues: error.format(),
    });
  }

  console.error(error);
  return reply.status(500).send({ message: "Erro interno do servidor." });
});
