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

export const app = fastify({
  bodyLimit: 5 * 1024 * 1024,
});

app.register(cors, {
  origin: ["http://localhost:3000", "https://estetica-front-pi.vercel.app"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
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
app.register(specialtyTemplateRoutes, { prefix: "/specialty-templates" });
app.register(medicalReportRoutes, { prefix: "/medical-reports" });
app.register(prescriptionRoutes, { prefix: "/prescriptions" });
app.register(professionalCouncilRoutes, { prefix: "/professional-councils" });
app.register(productCategoryRoutes, { prefix: "/product-categories" });
app.register(productBrandRoutes, { prefix: "/product-brands" });
app.register(supplierRoutes, { prefix: "/suppliers" });
app.register(productRoutes, { prefix: "/products" });
app.register(stockMovementRoutes, { prefix: "/stock-movements" });
app.register(commissionPlanRoutes, { prefix: "/commission-plans" });
app.register(paymentInstallmentRoutes, { prefix: "/payment-installments" });
app.register(expenseRoutes, { prefix: "/expenses" });
app.register(expenseCategoryRoutes, { prefix: "/expense-categories" });
app.register(commissionRecordRoutes, { prefix: "/commissions" });
app.register(cashRegisterRoutes, { prefix: "/cash-register" });
app.register(bankAccountRoutes, { prefix: "/bank-accounts" });
app.register(reportRoutes, { prefix: "/reports" });

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
