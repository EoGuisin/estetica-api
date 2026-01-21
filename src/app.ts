import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
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
import { specialtyTemplateRoutes } from "./routes/specialtyTemplate.routes";
import { medicalReportRoutes } from "./routes/medicalReport.routes";
import { prescriptionRoutes } from "./routes/prescription.routes";
import { professionalCouncilRoutes } from "./routes/professionalCouncil.routes";
import { productCategoryRoutes } from "./routes/productCategory.routes";
import { productBrandRoutes } from "./routes/productBrand.routes";
import { supplierRoutes } from "./routes/supplier.routes";
import { productRoutes } from "./routes/product.routes";
import { stockMovementRoutes } from "./routes/stockMovement.routes";
import { commissionPlanRoutes } from "./routes/commissionPlan.routes";
import { paymentInstallmentRoutes } from "./routes/paymentInstallment.routes";
import { expenseRoutes } from "./routes/expense.routes";
import { expenseCategoryRoutes } from "./routes/expenseCategory.routes";
import { commissionRecordRoutes } from "./routes/commissionRecord.routes";
import { cashRegisterRoutes } from "./routes/cashRegister.routes";
import { bankAccountRoutes } from "./routes/bankAccount.routes";
import { reportRoutes } from "./routes/report.routes";
import { authMiddleware } from "./middleware/auth.middleware";
import { clinicAccessMiddleware } from "./middleware/clinic-access.middleware";
import { accountRoutes } from "./routes/account.routes";
import { publicRoutes } from "./routes/public.routes";
import { clinicRoutes as clinicSettingsRoutes } from "./routes/clinic.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { subscriptionRoutes } from "./routes/subscription.routes";
import { roleGuard } from "./middleware/roleGuard";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const app = fastify({
  bodyLimit: 5 * 1024 * 1024,
});

app.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

app.register(cors, {
  origin: [
    "http://localhost:3001",
    "https://www.belliun.com.br",
    "https://belliun.com.br",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
});

app.get("/", () => {
  return { message: "API de Estética está funcionando!" };
});

app.register(authRoutes, { prefix: "/auth" });
app.register(publicRoutes);

app.register(async (app: FastifyInstance) => {
  app.addHook("preHandler", authMiddleware);
  app.register(accountRoutes, { prefix: "/account" });
  app.register(subscriptionRoutes, { prefix: "/account" });
});

const clinicRoutes = async (app: FastifyInstance, _opts: any) => {
  // Middlewares base: Quem é o usuário e em qual clínica ele está operando
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", clinicAccessMiddleware);

  // --- GRUPO 1: AGENDA E ATENDIMENTO (Acesso: TODOS) ---
  app.register(async (sub) => {
    sub.addHook(
      "preHandler",
      roleGuard(["ADMIN", "COMMERCIAL", "SECRETARY", "PROFESSIONAL"])
    );

    sub.register(dashboardRoutes, { prefix: "/dashboard" });
    sub.register(appointmentRoutes, { prefix: "/appointments" });
    sub.register(attendanceRoutes, { prefix: "/attendance" });
    sub.register(medicalReportRoutes, { prefix: "/medical-reports" });
    sub.register(prescriptionRoutes, { prefix: "/prescriptions" });
  });

  // --- GRUPO 2: FINANCEIRO, ESTOQUE E CADASTROS (Acesso: ADM, COMERCIAL, SECRETÁRIA) ---
  // Este grupo cobre quase tudo o que você listou como "Cadastros"
  app.register(async (sub) => {
    sub.addHook("preHandler", roleGuard(["ADMIN", "COMMERCIAL", "SECRETARY"]));

    sub.register(patientRoutes, { prefix: "/patients" });
    sub.register(catalogRoutes, { prefix: "/catalogs" }); // Especialidades, Tipos de Agendamento, etc
    sub.register(treatmentPlanRoutes, { prefix: "/treatment-plans" });
    sub.register(anamnesisRoutes, { prefix: "/anamnesis" });
    sub.register(specialtyTemplateRoutes, { prefix: "/specialty-templates" });
    sub.register(professionalCouncilRoutes, {
      prefix: "/professional-councils",
    });

    // Estoque
    sub.register(productRoutes, { prefix: "/products" });
    sub.register(productCategoryRoutes, { prefix: "/product-categories" });
    sub.register(productBrandRoutes, { prefix: "/product-brands" });
    sub.register(supplierRoutes, { prefix: "/suppliers" });
    sub.register(stockMovementRoutes, { prefix: "/stock-movements" });

    // Financeiro
    sub.register(bankAccountRoutes, { prefix: "/bank-accounts" });
    sub.register(cashRegisterRoutes, { prefix: "/cash-register" });
    sub.register(expenseRoutes, { prefix: "/expenses" });
    sub.register(expenseCategoryRoutes, { prefix: "/expense-categories" });
    sub.register(paymentInstallmentRoutes, { prefix: "/payment-installments" });
    sub.register(commissionRecordRoutes, { prefix: "/commissions" });
  });

  // --- GRUPO 3: RELATÓRIOS (Acesso: ADM e COMERCIAL) ---
  app.register(async (sub) => {
    sub.addHook("preHandler", roleGuard(["ADMIN", "COMMERCIAL"]));
    sub.register(reportRoutes, { prefix: "/reports" });
  });

  // --- GRUPO 4: GESTÃO DE EQUIPE E CONFIG. CLÍNICA (Acesso: APENAS ADM) ---
  app.register(async (sub) => {
    sub.addHook("preHandler", roleGuard(["ADMIN"]));
    sub.register(userRoutes, { prefix: "/users" });
    sub.register(clinicSettingsRoutes, { prefix: "/clinics" });
    sub.register(commissionPlanRoutes, { prefix: "/commission-plans" });
  });
};

app.register(clinicRoutes);

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
