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
import { anamnesisRoutes } from "./routes/anamnesis.routes";
import { attendanceRoutes } from "./routes/attendance.routes";

export const app = fastify({
  bodyLimit: 5 * 1024 * 1024,
});

app.register(cors, {
  origin: ["http://localhost:3000", "https://estetica-front-pi.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
});

app.get("/", () => {
  return { message: "API de Estética está funcionando!" };
});

app.register(authRoutes, { prefix: "/auth" });
app.register(dashboardRoutes, { prefix: "/dashboard" });
app.register(appointmentRoutes, { prefix: "/appointments" });
app.register(catalogRoutes, { prefix: "/catalogs" });
app.register(patientRoutes, { prefix: "/patients" });
app.register(userRoutes, { prefix: "/users" });
app.register(specialtyRoutes, { prefix: "/specialties" });
app.register(treatmentPlanRoutes, { prefix: "/treatment-plans" });
app.register(anamnesisRoutes, { prefix: "/anamnesis" });
app.register(attendanceRoutes, { prefix: "/attendance" });

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
