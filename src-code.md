# app.ts

```ts
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

```

# controllers\anamnesis.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { AnamnesisService } from "../services/anamnesis.service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  createAssessmentSchema,
} from "../schemas/anamnesis.schema";

export class AnamnesisController {
  static async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createTemplateSchema.parse(request.body);
    const template = await AnamnesisService.createTemplate(clinicId, data);
    return reply.status(201).send(template);
  }

  static async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const templates = await AnamnesisService.listTemplates(clinicId);
    return reply.send(templates);
  }

  static async getTemplateById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const template = await AnamnesisService.getTemplateById(id, clinicId);
    if (!template) {
      return reply.status(404).send({ message: "Template não encontrado." });
    }
    return reply.send(template);
  }

  static async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateTemplateSchema.parse(request.body);
    const template = await AnamnesisService.updateTemplate(id, clinicId, data);
    return reply.send(template);
  }

  static async deleteTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    await AnamnesisService.deleteTemplate(id, clinicId);
    return reply.status(204).send();
  }

  static async duplicateTemplate(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const newTemplate = await AnamnesisService.duplicateTemplate(id, clinicId);
    return reply.status(201).send(newTemplate);
  }

  static async createOrUpdateAssessment(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId, userId } = request.user;
    const { appointmentId } = request.params as { appointmentId: string };
    const data = createAssessmentSchema.parse(request.body);
    const assessment = await AnamnesisService.createOrUpdateAssessment(
      appointmentId,
      userId,
      clinicId,
      data
    );
    return reply.status(201).send(assessment);
  }

  static async getAssessmentByAppointment(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { appointmentId } = request.params as { appointmentId: string };
    const assessmentData = await AnamnesisService.getAssessmentByAppointment(
      appointmentId
    );
    return reply.send(assessmentData);
  }

  static async listPatientAssessments(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { patientId } = request.params as { patientId: string };
    const assessments = await AnamnesisService.listPatientAssessments(
      patientId
    );
    return reply.send(assessments);
  }

  static async getAssessmentById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const assessment = await AnamnesisService.getAssessmentById(id);
    if (!assessment) {
      return reply.status(404).send({ message: "Avaliação não encontrada." });
    }
    return reply.send(assessment);
  }
}

```

# controllers\appointment.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  appointmentParamsSchema,
  createAppointmentSchema,
  updateAppointmentStatusSchema,
} from "../schemas/appointment.schema";
import { AppointmentService } from "../services/appointment.service";

export class AppointmentController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createAppointmentSchema.parse(request.body);

    try {
      const appointment = await AppointmentService.create(clinicId, data);
      return reply.status(201).send(appointment);
    } catch (error: any) {
      if (error.name === "SessionLimitError") {
        return reply.status(409).send({
          message: error.message,
          details: `Sessões já agendadas em: ${error.scheduledDates.join(
            ", "
          )}.`,
        });
      }
      throw error;
    }
  }

  static async listPatients(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const patients = await AppointmentService.listPatients(clinicId);
    return reply.send(patients);
  }

  static async listAppointmentTypes(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const types = await AppointmentService.listAppointmentTypes();
    return reply.send(types);
  }

  static async listTreatmentPlansByPatient(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request.user;
    const { patientId } = request.params as { patientId: string };
    const plans = await AppointmentService.listTreatmentPlansByPatient(
      clinicId,
      patientId
    );
    return reply.send(plans);
  }

  static async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { status } = updateAppointmentStatusSchema.parse(request.body);

    const appointment = await AppointmentService.updateStatus(
      appointmentId,
      status
    );
    return reply.send(appointment);
  }
}

```

# controllers\attendance.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { AttendanceService } from "../services/attendance.service";
import {
  saveDiagnosisSchema,
  createSignedUrlSchema,
  saveAttachmentSchema,
  attachmentParamsSchema,
  appointmentParamsSchema,
  patientParamsSchema,
  createBeforeAfterSignedUrlSchema,
  saveBeforeAfterSchema,
  beforeAfterParamsSchema,
  updateAfterImageSchema,
  documentParamsSchema,
  listDocumentsQuerySchema,
  createDocumentSignedUrlSchema,
  saveDocumentSchema,
  updateDiagnosisSchema,
} from "../schemas/attendance.schema";
import z from "zod";

export class AttendanceController {
  static async getDocumentTemplates(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const { type } = listDocumentsQuerySchema.parse(request.query);

    const templates = await AttendanceService.getTemplatesForPatient(
      patientId,
      type
    );
    return reply.send(templates);
  }

  static async generateDocument(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { patientId, templateId } = z
      .object({
        patientId: z.string().uuid(),
        templateId: z.string().uuid(),
      })
      .parse(request.body);

    const document = await AttendanceService.generateDocumentFromTemplate({
      patientId,
      templateId,
      clinicId,
    });

    return reply.status(201).send(document);
  }

  static async getAttendanceData(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    const data = await AttendanceService.getAttendanceData(
      appointmentId,
      clinicId
    );
    return reply.send(data);
  }

  static async saveDiagnosis(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { diagnosis } = saveDiagnosisSchema.parse(request.body);

    const record = await AttendanceService.saveDiagnosis(
      appointmentId,
      diagnosis
    );
    return reply.send(record);
  }

  static async listAttachments(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    // You might want to add a check to ensure the patient belongs to the clinic
    const attachments = await AttendanceService.listAttachments(patientId);
    return reply.send(attachments);
  }

  static async createSignedUploadUrl(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request.user;
    const body = createSignedUrlSchema.parse(request.body);

    const signedUrlData = await AttendanceService.createSignedUploadUrl({
      ...body,
      clinicId,
    });
    return reply.send(signedUrlData);
  }

  static async saveAttachment(request: FastifyRequest, reply: FastifyReply) {
    const data = saveAttachmentSchema.parse(request.body);

    const attachment = await AttendanceService.saveAttachment(data);
    return reply.status(201).send(attachment);
  }

  static async deleteAttachment(request: FastifyRequest, reply: FastifyReply) {
    const { attachmentId } = attachmentParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    await AttendanceService.deleteAttachment(attachmentId, clinicId);
    return reply.status(204).send();
  }

  static async getBeforeAfterImages(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const images = await AttendanceService.getBeforeAfterImages(patientId);
    return reply.send(images);
  }

  static async createBeforeAfterSignedUrl(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request.user;
    const body = createBeforeAfterSignedUrlSchema.parse(request.body);

    const signedUrlData = await AttendanceService.createBeforeAfterSignedUrl({
      ...body,
      clinicId,
    });
    return reply.send(signedUrlData);
  }

  static async saveBeforeAfterImage(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const data = saveBeforeAfterSchema.parse(request.body);
    const image = await AttendanceService.saveBeforeAfterImage(data);
    return reply.status(201).send(image);
  }

  static async updateAfterImage(request: FastifyRequest, reply: FastifyReply) {
    const { imageId } = beforeAfterParamsSchema.parse(request.params);
    const { afterImagePath } = updateAfterImageSchema.parse(request.body);

    const updatedImage = await AttendanceService.updateAfterImage(
      imageId,
      afterImagePath
    );
    return reply.send(updatedImage);
  }

  static async deleteBeforeAfterImage(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { imageId } = beforeAfterParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    await AttendanceService.deleteBeforeAfterImage(imageId, clinicId);
    return reply.status(204).send();
  }

  static async listDocuments(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const { type } = listDocumentsQuerySchema.parse(request.query);

    const documents = await AttendanceService.listDocuments(patientId, type);
    return reply.send(documents);
  }

  static async createDocumentSignedUrl(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request.user;
    const body = createDocumentSignedUrlSchema.parse(request.body);

    const signedUrlData = await AttendanceService.createDocumentSignedUrl({
      ...body,
      clinicId,
    });
    return reply.send(signedUrlData);
  }

  static async saveDocument(request: FastifyRequest, reply: FastifyReply) {
    const data = saveDocumentSchema.parse(request.body);

    const document = await AttendanceService.saveDocument(data);
    return reply.status(201).send(document);
  }

  static async deleteDocument(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { documentId } = documentParamsSchema.parse(request.params);

    await AttendanceService.deleteDocument(documentId, clinicId);
    return reply.status(204).send();
  }

  static async downloadDocument(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = documentParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    const { signedUrl, fileName, fileType } =
      await AttendanceService.getDocumentDownloadUrl(documentId, clinicId);

    return reply.redirect(signedUrl, 302);
  }

  static async downloadAttachment(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { attachmentId } = attachmentParamsSchema.parse(request.params);
    const { clinicId } = request.user;

    const { signedUrl } = await AttendanceService.getAttachmentDownloadUrl(
      attachmentId,
      clinicId
    );

    return reply.redirect(signedUrl);
  }

  static async downloadBeforeAfterImage(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { imageId } = beforeAfterParamsSchema.parse(request.params);
    const { type } = z
      .object({ type: z.enum(["before", "after"]) })
      .parse(request.query);
    const { clinicId } = request.user;

    const { signedUrl } = await AttendanceService.getBeforeAfterDownloadUrl(
      imageId,
      type,
      clinicId
    );
    return reply.redirect(signedUrl);
  }

  static async updateDiagnosis(request: FastifyRequest, reply: FastifyReply) {
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { diagnosis } = updateDiagnosisSchema.parse(request.body);

    const clinicalRecord = await AttendanceService.saveDiagnosis(
      appointmentId,
      diagnosis
    );
    return reply.send(clinicalRecord);
  }
}

```

# controllers\auth.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../schemas/auth.schema";
import { AuthService } from "../services/auth.service";

export class AuthController {
  static async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = loginSchema.parse(request.body);
      const result = await AuthService.login(data);
      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.code === "UNAUTHORIZED") {
        return reply.status(401).send({ message: error.message });
      }
      throw error;
    }
  }

  static async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = registerSchema.parse(request.body);
      const result = await AuthService.register(data);
      return reply.status(201).send(result);
    } catch (error: any) {
      if (error.code === "CONFLICT") {
        return reply.status(409).send({ message: error.message });
      }
      throw error;
    }
  }

  static async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = forgotPasswordSchema.parse(request.body);
      const result = await AuthService.forgotPassword(data);
      return reply.status(200).send(result);
    } catch (error) {
      throw error;
    }
  }

  static async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = resetPasswordSchema.parse(request.body);
      const result = await AuthService.resetPassword(data);
      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.code === "NOT_FOUND")
        return reply.status(404).send({ message: error.message });
      if (error.code === "GONE")
        return reply.status(410).send({ message: error.message });
      throw error;
    }
  }
}

```

# controllers\catalog.controller.ts

```ts
// src/controllers/catalog.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { CatalogService } from "../services/catalog.service";
import {
  genericCatalogSchema,
  procedureSchema,
  roleSchema,
} from "../schemas/catalog.schema";

const getModel = (modelName: string) => {
  if (
    ![
      "specialty",
      "appointmentType",
      "trafficSource",
      "procedure",
      "role",
    ].includes(modelName)
  ) {
    throw new Error("Catálogo inválido");
  }
  return modelName as any;
};

export class CatalogController {
  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };
    const item = await CatalogService.getById(getModel(modelName), id);
    if (!item) {
      return reply.status(404).send({ message: "Item não encontrado." });
    }
    return reply.send(item);
  }
  // A função list não precisa de alteração, pois a genérica já funciona para 'role'
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { modelName } = request.params as { modelName: string };
    const model = getModel(modelName);

    if (model === "procedure") {
      return reply.send(await CatalogService.listProcedures());
    }
    const items = await CatalogService.list(model);
    return reply.send(items);
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { modelName } = request.params as { modelName: string };
    const model = getModel(modelName);

    let data;
    // CORREÇÃO 2: Adicionar um 'else if' para usar o schema de 'role'
    if (model === "procedure") {
      data = procedureSchema.parse(request.body);
      const item = await CatalogService.createProcedure(data);
      return reply.status(201).send(item);
    } else if (model === "role") {
      data = roleSchema.parse(request.body);
    } else {
      data = genericCatalogSchema.parse(request.body);
    }

    const item = await CatalogService.create(model, data);
    return reply.status(201).send(item);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };
    const model = getModel(modelName);

    let data;
    // CORREÇÃO 3: Adicionar um 'else if' para usar o schema de 'role' também na atualização
    if (model === "procedure") {
      data = procedureSchema.parse(request.body);
      const item = await CatalogService.updateProcedure(id, data);
      return reply.send(item);
    } else if (model === "role") {
      data = roleSchema.parse(request.body);
    } else {
      data = genericCatalogSchema.parse(request.body);
    }

    const item = await CatalogService.update(model, id, data);
    return reply.send(item);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };
    await CatalogService.delete(getModel(modelName), id);
    return reply.status(204).send();
  }
}

```

# controllers\commissionPlan.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createCommissionPlanSchema,
  updateCommissionPlanSchema,
} from "../schemas/commission.schema";
import { CommissionPlanService } from "../services/commissionPlan.service";

export class CommissionPlanController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createCommissionPlanSchema.parse(request.body);

      const plan = await CommissionPlanService.create(data, clinicId);
      return reply.status(201).send(plan);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Um plano de comissão com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      name,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
    };

    const result = await CommissionPlanService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    const plan = await CommissionPlanService.getById(id, clinicId);

    if (!plan) {
      return reply
        .status(404)
        .send({ message: "Plano de comissão não encontrado." });
    }
    return reply.send(plan);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateCommissionPlanSchema.parse(request.body);

    const plan = await CommissionPlanService.update(id, data, clinicId);
    return reply.send(plan);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    try {
      await CommissionPlanService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "PLAN_IN_USE") {
        return reply.status(409).send({
          message:
            "Este plano não pode ser excluído pois está vinculado a um ou mais profissionais.",
        });
      }
      throw error;
    }
  }
}

```

# controllers\commissionRecord.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { CommissionRecordService } from "../services/commissionRecord.service";
import { markCommissionAsPaidSchema } from "../schemas/commissionRecord.schema";
import { CommissionStatus } from "@prisma/client";

export class CommissionRecordController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      professionalId,
      status,
      dateStart,
      dateEnd,
    } = request.query as {
      page?: string;
      pageSize?: string;
      professionalId?: string;
      status?: CommissionStatus;
      dateStart?: string;
      dateEnd?: string;
    };

    // Valida o status se fornecido
    const validStatus =
      status && Object.values(CommissionStatus).includes(status)
        ? status
        : undefined;

    const result = await CommissionRecordService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { professionalId, status: validStatus, dateStart, dateEnd }
    );
    return reply.send(result);
  }

  static async markAsPaid(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = markCommissionAsPaidSchema.parse(request.body);

      const record = await CommissionRecordService.markAsPaid(
        id,
        clinicId,
        data
      );
      return reply.send(record);
    } catch (error: any) {
      if (error.code === "P2025") {
        // Prisma RecordNotFound
        return reply
          .status(404)
          .send({ message: "Registro de comissão não encontrado ou já pago." });
      }
      throw error;
    }
  }
}

```

# controllers\dashboard.controller.ts

```ts
// src/controllers/dashboard.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { DashboardService } from "../services/dashboard.service";

export class DashboardController {
  static async getProfessionals(request: FastifyRequest, reply: FastifyReply) {
    // Agora 'request.user' existe e está tipado graças ao middleware
    const { clinicId } = request.user;
    const professionals = await DashboardService.getProfessionals(clinicId);
    return reply.send(professionals);
  }

  static async getAppointments(request: FastifyRequest, reply: FastifyReply) {
    // O mesmo aqui, 'clinicId' é obtido de forma segura
    const { clinicId } = request.user;
    const { start, end, professionals } = request.query as {
      start: string;
      end: string;
      professionals?: string;
    };

    if (!start || !end) {
      return reply
        .status(400)
        .send({ message: "As datas de início e fim são obrigatórias." });
    }

    const professionalIds = professionals?.split(",").filter(id => id); // Garante que não haja strings vazias

    const appointments = await DashboardService.getAppointments(
      clinicId,
      new Date(start),
      new Date(end),
      professionalIds
    );
    return reply.send(appointments);
  }
}
```

# controllers\expense.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ExpenseService } from "../services/expense.service";
import {
  createExpenseSchema,
  updateExpenseSchema,
  markExpenseAsPaidSchema,
} from "../schemas/expense.schema";
import { PaymentStatus } from "@prisma/client";

export class ExpenseController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createExpenseSchema.parse(request.body);
    const expense = await ExpenseService.create(data, clinicId);
    return reply.status(201).send(expense);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      status,
      dueDateStart,
      dueDateEnd,
      categoryId,
      supplierId,
    } = request.query as {
      page?: string;
      pageSize?: string;
      status?: string | string[];
      dueDateStart?: string;
      dueDateEnd?: string;
      categoryId?: string;
      supplierId?: string;
    };

    let statusArray: PaymentStatus[] | undefined = undefined;
    if (status) {
      const rawStatuses = Array.isArray(status) ? status : [status];
      statusArray = rawStatuses.filter((s) =>
        Object.values(PaymentStatus).includes(s as PaymentStatus)
      ) as PaymentStatus[];
    }

    const result = await ExpenseService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { status: statusArray, dueDateStart, dueDateEnd, categoryId, supplierId }
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const expense = await ExpenseService.getById(id, clinicId);
    if (!expense) {
      return reply.status(404).send({ message: "Despesa não encontrada." });
    }
    return reply.send(expense);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateExpenseSchema.parse(request.body);
    const expense = await ExpenseService.update(id, clinicId, data);
    return reply.send(expense);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    await ExpenseService.delete(id, clinicId);
    return reply.status(204).send();
  }

  static async markAsPaid(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = markExpenseAsPaidSchema.parse(request.body);
      const expense = await ExpenseService.markAsPaid(id, clinicId, data);
      return reply.send(expense);
    } catch (error: any) {
      if (error.code === "P2025") {
        return reply.status(404).send({
          message: "Despesa não encontrada ou inválida para pagamento.",
        });
      }
      throw error;
    }
  }
}

```

# controllers\expenseCategory.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ExpenseCategoryService } from "../services/expenseCategory.service";
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
} from "../schemas/expenseCategory.schema";

export class ExpenseCategoryController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createExpenseCategorySchema.parse(request.body);
      const category = await ExpenseCategoryService.create(data, clinicId);
      return reply.status(201).send(category);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Uma categoria com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { name } = request.query as { name?: string };
    const categories = await ExpenseCategoryService.list(clinicId, name);
    // Para consistência com outras listagens, retornamos um objeto { data: ..., totalCount: ... }
    // Embora não haja paginação aqui, facilita o frontend.
    return reply.send({ data: categories, totalCount: categories.length });
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const category = await ExpenseCategoryService.getById(id, clinicId);
    if (!category) {
      return reply.status(404).send({ message: "Categoria não encontrada." });
    }
    return reply.send(category);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateExpenseCategorySchema.parse(request.body);
    const category = await ExpenseCategoryService.update(id, clinicId, data);
    return reply.send(category);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    try {
      await ExpenseCategoryService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "CATEGORY_IN_USE") {
        return reply.status(409).send({
          message: "Categoria em uso por despesas, não pode ser excluída.",
        });
      }
      throw error;
    }
  }
}

```

# controllers\medicalReport.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { MedicalReportService } from "../services/medicalReport.service";
import {
  createReportSchema,
  updateReportSchema,
  reportParamsSchema,
  patientParamsSchema,
} from "../schemas/medicalReport.schema";

export class MedicalReportController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    // FIX: Use request.user.userId which comes from the auth token payload
    const professionalId = request.user.userId;

    // FIX: Cast request.body to object to avoid spread type errors
    const data = createReportSchema.parse({
      ...(request.body as object),
      professionalId,
    });

    const report = await MedicalReportService.create(data);
    return reply.status(201).send(report);
  }

  static async findByPatientId(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const reports = await MedicalReportService.findByPatientId(patientId);
    return reply.send(reports);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { reportId } = reportParamsSchema.parse(request.params);
    const data = updateReportSchema.parse(request.body);
    const report = await MedicalReportService.update(reportId, data);
    return reply.send(report);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { reportId } = reportParamsSchema.parse(request.params);
    await MedicalReportService.delete(reportId);
    return reply.status(204).send();
  }

  static async downloadPdf(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { reportId } = reportParamsSchema.parse(request.params);
    const pdfBuffer = await MedicalReportService.generatePdf(
      reportId,
      clinicId
    );

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="laudo-${reportId}.pdf"`
    );
    return reply.send(pdfBuffer);
  }
}

```

# controllers\patient.controller.ts

```ts
// src/controllers/patient.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createPatientSchema,
  updatePatientSchema,
} from "../schemas/patient.schema";
import { PatientService } from "../services/patient.service";

export class PatientController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createPatientSchema.parse(request.body);

      const patient = await PatientService.create(clinicId, data);
      return reply.status(201).send(patient);
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target.includes("cpf")) {
        return reply
          .status(409)
          .send({ message: "Este CPF já está cadastrado." });
      }
      throw error;
    }
  }
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      name,
      document,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
      document?: string;
    };

    const pageNumber = Number.parseInt(page, 10);
    const pageSizeNumber = Number.parseInt(pageSize, 10);

    const result = await PatientService.list(
      clinicId,
      pageNumber,
      pageSizeNumber,
      name,
      document
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const patient = await PatientService.getById(id, clinicId);
    if (!patient) {
      return reply.status(404).send({ message: "Paciente não encontrado." });
    }
    return reply.send(patient);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updatePatientSchema.parse(request.body);
    const patient = await PatientService.update(id, clinicId, data);
    return reply.send(patient);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    await PatientService.delete(id, clinicId);
    return reply.status(204).send();
  }
}

```

# controllers\paymentInstallment.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { PaymentInstallmentService } from "../services/paymentInstallment.service";
import { registerPaymentSchema } from "../schemas/paymentInstallment.schema";
import { PaymentStatus } from "@prisma/client";

export class PaymentInstallmentController {

  static async registerPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = registerPaymentSchema.parse(request.body);

      const installment = await PaymentInstallmentService.registerPayment(
        id,
        clinicId,
        data
      );
      return reply.send(installment);
    } catch (error: any) {
      // Tratar erros como 'Parcela não encontrada ou já paga'
      if (error.code === 'P2025') { // Prisma's RecordNotFound error
         return reply.status(404).send({ message: "Parcela não encontrada ou inválida para pagamento." });
      }
      // Outros erros específicos do serviço poderiam ser tratados aqui
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      status, // Recebe como string ou array de strings
      dueDateStart,
      dueDateEnd,
      patientId,
      treatmentPlanId
    } = request.query as {
      page?: string;
      pageSize?: string;
      status?: string | string[];
      dueDateStart?: string;
      dueDateEnd?: string;
      patientId?: string;
      treatmentPlanId?: string;
    };

    // Converte 'status' para array se vier como string
    let statusArray: PaymentStatus[] | undefined = undefined;
    if (status) {
       const rawStatuses = Array.isArray(status) ? status : [status];
       statusArray = rawStatuses.filter(s => Object.values(PaymentStatus).includes(s as PaymentStatus)) as PaymentStatus[];
    }


    const result = await PaymentInstallmentService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { 
        status: statusArray, 
        dueDateStart, 
        dueDateEnd, 
        patientId,
        treatmentPlanId
      }
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const installment = await PaymentInstallmentService.getById(id, clinicId);
    if (!installment) {
      return reply.status(404).send({ message: "Parcela não encontrada." });
    }
    return reply.send(installment);
  }
}
```

# controllers\prescription.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { PrescriptionService } from "../services/prescription.service";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
  prescriptionParamsSchema,
  patientParamsSchema,
} from "../schemas/prescription.schema";

export class PrescriptionController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    // FIX: Use request.user.userId which comes from the auth token payload
    const professionalId = request.user.userId;

    // FIX: Cast request.body to object to avoid spread type errors
    const data = createPrescriptionSchema.parse({
      ...(request.body as object),
      professionalId,
    });

    const prescription = await PrescriptionService.create(data);
    return reply.status(201).send(prescription);
  }

  static async findByPatientId(request: FastifyRequest, reply: FastifyReply) {
    const { patientId } = patientParamsSchema.parse(request.params);
    const prescriptions = await PrescriptionService.findByPatientId(patientId);
    return reply.send(prescriptions);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { prescriptionId } = prescriptionParamsSchema.parse(request.params);
    const data = updatePrescriptionSchema.parse(request.body);
    const prescription = await PrescriptionService.update(prescriptionId, data);
    return reply.send(prescription);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { prescriptionId } = prescriptionParamsSchema.parse(request.params);
    await PrescriptionService.delete(prescriptionId);
    return reply.status(204).send();
  }

  static async downloadPdf(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { prescriptionId } = prescriptionParamsSchema.parse(request.params);
    const pdfBuffer = await PrescriptionService.generatePdf(
      prescriptionId,
      clinicId
    );

    reply.header("Content-Type", "application/pdf");
    reply.header(
      "Content-Disposition",
      `attachment; filename="receita-${prescriptionId}.pdf"`
    );
    return reply.send(pdfBuffer);
  }
}

```

# controllers\product.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createProductSchema,
  updateProductSchema,
} from "../schemas/product.schema";
import { ProductService } from "../services/product.service";

export class ProductController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createProductSchema.parse(request.body);

      const product = await ProductService.create(data, clinicId);
      return reply.status(201).send(product);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Um produto com este SKU já existe." });
      }
      // Prisma's findFirstOrThrow throws an error with this code
      if (error.code === "P2025") {
        return reply.status(404).send({
          message:
            "Categoria ou Marca não encontrada. Verifique os dados e tente novamente.",
        });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      name,
      sku,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
      sku?: string;
    };

    const result = await ProductService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name,
      sku
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    const product = await ProductService.getById(id, clinicId);

    if (!product) {
      return reply.status(404).send({ message: "Produto não encontrado." });
    }
    return reply.send(product);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = updateProductSchema.parse(request.body);

      const product = await ProductService.update(id, data, clinicId);
      return reply.send(product);
    } catch (error: any) {
      if (error.code === "P2025") {
        return reply.status(404).send({
          message:
            "Produto, Categoria ou Marca não encontrada. Verifique os dados e tente novamente.",
        });
      }
      throw error;
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    try {
      await ProductService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "PRODUCT_IN_USE") {
        return reply.status(409).send({
          message:
            "Este produto não pode ser excluído pois possui um histórico de movimentações no estoque.",
        });
      }

      throw error;
    }
  }
}

```

# controllers\productBrand.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createProductBrandSchema,
  updateProductBrandSchema,
} from "../schemas/productBrand.schema";
import { ProductBrandService } from "../services/productBrand.service";

export class ProductBrandController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createProductBrandSchema.parse(request.body);

      const brand = await ProductBrandService.create(data, clinicId);
      return reply.status(201).send(brand);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Uma marca com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      name,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
    };

    const result = await ProductBrandService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    const brand = await ProductBrandService.getById(id, clinicId);

    if (!brand) {
      return reply.status(404).send({ message: "Marca não encontrada." });
    }
    return reply.send(brand);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateProductBrandSchema.parse(request.body);

    const brand = await ProductBrandService.update(id, data, clinicId);
    return reply.send(brand);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    try {
      await ProductBrandService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "BRAND_IN_USE") {
        return reply.status(409).send({
          message:
            "Esta marca não pode ser excluída pois está sendo utilizada por um ou mais produtos.",
        });
      }
      throw error;
    }
  }
}

```

# controllers\productCategory.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createProductCategorySchema,
  updateProductCategorySchema,
} from "../schemas/productCategory.schema";
import { ProductCategoryService } from "../services/productCategory.service";

export class ProductCategoryController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createProductCategorySchema.parse(request.body);

      const category = await ProductCategoryService.create(data, clinicId);
      return reply.status(201).send(category);
    } catch (error: any) {
      // Trata erro de nome duplicado (definido no @@unique do schema)
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Uma categoria com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      name,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
    };

    const result = await ProductCategoryService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    const category = await ProductCategoryService.getById(id, clinicId);

    if (!category) {
      return reply.status(404).send({ message: "Categoria não encontrada." });
    }
    return reply.send(category);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateProductCategorySchema.parse(request.body);

    const category = await ProductCategoryService.update(id, data, clinicId);
    return reply.send(category);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    try {
      await ProductCategoryService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      // Trata a regra de negócio do serviço
      if (error.message === "CATEGORY_IN_USE") {
        return reply.status(409).send({
          message:
            "Esta categoria não pode ser excluída pois está sendo utilizada por um ou mais produtos.",
        });
      }
      throw error;
    }
  }
}

```

# controllers\professionalCouncil.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { ProfessionalCouncilService } from "../services/professionalCouncil.service";
import {
  createProfessionalCouncilSchema,
  updateProfessionalCouncilSchema,
} from "../schemas/professionalCouncil.schema";

export class ProfessionalCouncilController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createProfessionalCouncilSchema.parse(request.body);
      const council = await ProfessionalCouncilService.create(data);
      return reply.status(201).send(council);
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target.includes("name")) {
        return reply
          .status(409)
          .send({ message: "Um conselho com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const {
      page = "1",
      pageSize = "10",
      name,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
    };

    const pageNumber = Number.parseInt(page, 10);
    const pageSizeNumber = Number.parseInt(pageSize, 10);

    const result = await ProfessionalCouncilService.list(
      pageNumber,
      pageSizeNumber,
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const council = await ProfessionalCouncilService.getById(id);
    if (!council) {
      return reply
        .status(404)
        .send({ message: "Conselho profissional não encontrado." });
    }
    return reply.send(council);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = updateProfessionalCouncilSchema.parse(request.body);
    const council = await ProfessionalCouncilService.update(id, data);
    return reply.send(council);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await ProfessionalCouncilService.delete(id);
    return reply.status(204).send();
  }
}

```

# controllers\specialty.controller.ts

```ts
// src/controllers/specialty.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { SpecialtyService } from "../services/specialty.service";
import { specialtySchema } from "../schemas/specialty.schema";

export class SpecialtyController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const specialties = await SpecialtyService.list();
    return reply.send(specialties);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const specialty = await SpecialtyService.getById(id);
    return reply.send(specialty);
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = specialtySchema.parse(request.body);
    const specialty = await SpecialtyService.create(data);
    return reply.status(201).send(specialty);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = specialtySchema.parse(request.body);
    const specialty = await SpecialtyService.update(id, data);
    return reply.send(specialty);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await SpecialtyService.delete(id);
    return reply.status(204).send();
  }
}

```

# controllers\specialtyTemplate.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { SpecialtyTemplateService } from "../services/specialtyTemplate.service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  templateParamsSchema,
  specialtyParamsSchema,
  listTemplatesQuerySchema,
} from "../schemas/specialtyTemplate.schema";
import { TEMPLATE_VARIABLES } from "../lib/templateVariables";

export class SpecialtyTemplateController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createTemplateSchema.parse(request.body);
    const template = await SpecialtyTemplateService.create(data);
    return reply.status(201).send(template);
  }

  static async findMany(request: FastifyRequest, reply: FastifyReply) {
    const { specialtyId } = specialtyParamsSchema.parse(request.params);
    const { type } = listTemplatesQuerySchema.parse(request.query);
    const templates = await SpecialtyTemplateService.findMany(
      specialtyId,
      type
    );
    return reply.send(templates);
  }

  static async findById(request: FastifyRequest, reply: FastifyReply) {
    const { templateId } = templateParamsSchema.parse(request.params);
    const template = await SpecialtyTemplateService.findById(templateId);
    return reply.send(template);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { templateId } = templateParamsSchema.parse(request.params);
    const data = updateTemplateSchema.parse(request.body);
    const template = await SpecialtyTemplateService.update(templateId, data);
    return reply.send(template);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { templateId } = templateParamsSchema.parse(request.params);
    await SpecialtyTemplateService.delete(templateId);
    return reply.status(204).send();
  }

  static async getVariables(request: FastifyRequest, reply: FastifyReply) {
    return reply.send(TEMPLATE_VARIABLES);
  }
}

```

# controllers\stockMovement.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createStockMovementSchema } from "../schemas/stockMovement.schema";
import { StockMovementService } from "../services/stockMovement.service";

export class StockMovementController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createStockMovementSchema.parse(request.body);

      const movement = await StockMovementService.create(data, clinicId);
      return reply.status(201).send(movement);
    } catch (error: any) {
      // Trata o erro de estoque insuficiente lançado pelo serviço
      if (error.message === "Estoque insuficiente para a saída.") {
        return reply.status(400).send({ message: error.message });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "15",
      productId,
      type,
    } = request.query as {
      page?: string;
      pageSize?: string;
      productId?: string;
      type?: "ENTRY" | "EXIT";
    };

    const result = await StockMovementService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { productId, type }
    );
    return reply.send(result);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };

      await StockMovementService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message.includes("estoque ficaria negativo")) {
        return reply.status(409).send({ message: error.message });
      }
      throw error;
    }
  }
}

```

# controllers\supplier.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "../schemas/supplier.schema";
import { SupplierService } from "../services/supplier.service";

export class SupplierController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createSupplierSchema.parse(request.body);

      const supplier = await SupplierService.create(data, clinicId);
      return reply.status(201).send(supplier);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Um fornecedor com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      name,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
    };

    const result = await SupplierService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    const supplier = await SupplierService.getById(id, clinicId);

    if (!supplier) {
      return reply.status(404).send({ message: "Fornecedor não encontrado." });
    }
    return reply.send(supplier);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateSupplierSchema.parse(request.body);

    const supplier = await SupplierService.update(id, data, clinicId);
    return reply.send(supplier);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    try {
      await SupplierService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "SUPPLIER_IN_USE") {
        return reply.status(409).send({
          message:
            "Este fornecedor não pode ser excluído pois possui movimentações de estoque registradas.",
        });
      }
      throw error;
    }
  }
}

```

# controllers\treatmentPlan.controller.ts

```ts
import { FastifyRequest, FastifyReply } from "fastify";
import { TreatmentPlanService } from "../services/treatmentPlan.service";
import { createTreatmentPlanSchema } from "../schemas/treatmentPlan.schema";

export class TreatmentPlanController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createTreatmentPlanSchema.parse(request.body);
    const plan = await TreatmentPlanService.create(clinicId, data);
    return reply.status(201).send(plan);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const plans = await TreatmentPlanService.list(clinicId);
    return reply.send(plans);
  }
  
  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const plan = await TreatmentPlanService.getById(id, clinicId);
    if (!plan) {
      return reply.status(404).send({ message: "Plano não encontrado." });
    }
    return reply.send(plan);
  }
}

```

# controllers\user.controller.ts

```ts
// src/controllers/professional.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { UserService } from "../services/user.service";
import { createUserSchema, updateUserSchema } from "../schemas/user.schema";

export class UserController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createUserSchema.parse(request.body);
    const user = await UserService.create(clinicId, data);
    return reply.status(201).send(user);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      name,
      document,
    } = request.query as any;
    const result = await UserService.list(
      clinicId,
      parseInt(page),
      parseInt(pageSize),
      name,
      document
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const user = await UserService.getById(id, clinicId);
    return reply.send(user);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateUserSchema.parse(request.body);
    const user = await UserService.update(id, clinicId, data);
    return reply.send(user);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    await UserService.delete(id, clinicId);
    return reply.status(204).send();
  }
}

```

# lib\prisma.ts

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

```

# lib\supabase.ts

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase URL and Key must be defined in .env");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

```

# lib\templateVariables.ts

```ts
export const TEMPLATE_VARIABLES = {
  // Patient variables
  "paciente.nome": "Nome completo do paciente",
  "paciente.cpf": "CPF do paciente",
  "paciente.rg": "RG do paciente",
  "paciente.dataNascimento": "Data de nascimento do paciente",
  "paciente.idade": "Idade do paciente",
  "paciente.genero": "Gênero do paciente",
  "paciente.nomeSocial": "Nome social do paciente",
  "paciente.nomeMae": "Nome da mãe do paciente",
  "paciente.ocupacao": "Ocupação do paciente",
  "paciente.telefone": "Telefone principal do paciente",

  // Patient address
  "paciente.endereco.cep": "CEP",
  "paciente.endereco.estado": "Estado",
  "paciente.endereco.cidade": "Cidade",
  "paciente.endereco.bairro": "Bairro",
  "paciente.endereco.rua": "Rua",
  "paciente.endereco.numero": "Número",
  "paciente.endereco.complemento": "Complemento",
  "paciente.endereco.completo": "Endereço completo formatado",

  // Clinic variables
  "clinica.nome": "Nome da clínica",
  "clinica.cnpj": "CNPJ da clínica",
  "clinica.endereco.completo": "Endereço completo da clínica",

  // Treatment plan variables
  "plano.especialidade": "Nome da especialidade",
  "plano.procedimento": "Nome do procedimento",
  "plano.sessoes": "Número de sessões contratadas",
  "plano.valorTotal": "Valor total do tratamento",

  // Date variables
  "data.hoje": "Data de hoje",
  "data.hojeExtenso": "Data de hoje por extenso",
};

export function substituteVariables(
  template: string,
  data: {
    patient: any;
    clinic: any;
    treatmentPlan?: any;
  }
): string {
  let result = template;

  // Patient data
  result = result.replace(/{{paciente\.nome}}/g, data.patient.name || "");
  result = result.replace(
    /{{paciente\.cpf}}/g,
    formatCPF(data.patient.cpf) || ""
  );
  result = result.replace(/{{paciente\.rg}}/g, data.patient.identityCard || "");
  result = result.replace(
    /{{paciente\.dataNascimento}}/g,
    formatDate(data.patient.birthDate) || ""
  );
  result = result.replace(
    /{{paciente\.idade}}/g,
    calculateAge(data.patient.birthDate).toString()
  );
  result = result.replace(/{{paciente\.genero}}/g, data.patient.gender || "");
  result = result.replace(
    /{{paciente\.nomeSocial}}/g,
    data.patient.socialName || ""
  );
  result = result.replace(
    /{{paciente\.nomeMae}}/g,
    data.patient.motherName || ""
  );
  result = result.replace(
    /{{paciente\.ocupacao}}/g,
    data.patient.occupation || ""
  );

  // Patient address
  if (data.patient.address) {
    result = result.replace(
      /{{paciente\.endereco\.cep}}/g,
      data.patient.address.zipCode || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.estado}}/g,
      data.patient.address.state || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.cidade}}/g,
      data.patient.address.city || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.bairro}}/g,
      data.patient.address.neighborhood || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.rua}}/g,
      data.patient.address.street || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.numero}}/g,
      data.patient.address.number || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.complemento}}/g,
      data.patient.address.complement || ""
    );
    result = result.replace(
      /{{paciente\.endereco\.completo}}/g,
      formatAddress(data.patient.address)
    );
  }

  // Clinic data
  result = result.replace(/{{clinica\.nome}}/g, data.clinic.name || "");
  result = result.replace(
    /{{clinica\.cnpj}}/g,
    formatCNPJ(data.clinic.taxId) || ""
  );
  if (data.clinic.address) {
    result = result.replace(
      /{{clinica\.endereco\.completo}}/g,
      formatAddress(data.clinic.address)
    );
  }

  // Treatment plan data
  if (data.treatmentPlan) {
    result = result.replace(
      /{{plano\.especialidade}}/g,
      data.treatmentPlan.specialty || ""
    );
    result = result.replace(
      /{{plano\.procedimento}}/g,
      data.treatmentPlan.procedure || ""
    );
    result = result.replace(
      /{{plano\.sessoes}}/g,
      data.treatmentPlan.sessions?.toString() || ""
    );
    result = result.replace(
      /{{plano\.valorTotal}}/g,
      formatCurrency(data.treatmentPlan.total) || ""
    );
  }

  // Date variables
  const today = new Date();
  result = result.replace(/{{data\.hoje}}/g, formatDate(today));
  result = result.replace(/{{data\.hojeExtenso}}/g, formatDateExtensive(today));

  return result;
}

function formatCPF(cpf: string): string {
  if (!cpf) return "";
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatCNPJ(cnpj: string): string {
  if (!cnpj) return "";
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR");
}

function formatDateExtensive(date: Date): string {
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const d = new Date(date);
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function calculateAge(birthDate: Date | string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatAddress(address: any): string {
  const parts = [
    address.street,
    address.number,
    address.complement,
    address.neighborhood,
    address.city,
    address.state,
    address.zipCode,
  ].filter(Boolean);
  return parts.join(", ");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

```

# middleware\auth.middleware.ts

```ts
// src/middleware/auth.middleware.ts
import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import jwt from "jsonwebtoken";

interface UserPayload {
  userId: string;
  roleId: string;
  clinicId: string;
}

// Estende a interface do FastifyRequest para incluir nosso payload 'user'
declare module "fastify" {
  interface FastifyRequest {
    user: UserPayload;
  }
}

export function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply
      .status(401)
      .send({ message: "Token de autenticação não fornecido." });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2) {
    return reply.status(401).send({ message: "Erro no formato do token." });
  }

  const [scheme, token] = parts;

  if (!/^Bearer$/i.test(scheme)) {
    return reply.status(401).send({ message: "Token mal formatado." });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Este erro é para o desenvolvedor, não para o usuário final
    throw new Error("Chave secreta JWT não configurada no .env");
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return reply.status(401).send({ message: "Token inválido ou expirado." });
    }

    // Anexa o payload decodificado ao objeto de requisição
    request.user = decoded as UserPayload;
    done();
  });
}

```

# routes\anamnesis.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AnamnesisController } from "../controllers/anamnesis.controller";

export async function anamnesisRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/templates", AnamnesisController.listTemplates);
  app.post("/templates", AnamnesisController.createTemplate);
  app.get("/templates/:id", AnamnesisController.getTemplateById);
  app.put("/templates/:id", AnamnesisController.updateTemplate);
  app.delete("/templates/:id", AnamnesisController.deleteTemplate);
  app.post("/templates/:id/duplicate", AnamnesisController.duplicateTemplate);

  app.get(
    "/assessments/patient/:patientId",
    AnamnesisController.listPatientAssessments
  );
  app.get(
    "/assessments/appointment/:appointmentId",
    AnamnesisController.getAssessmentByAppointment
  );
  app.post(
    "/assessments/appointment/:appointmentId",
    AnamnesisController.createOrUpdateAssessment
  );
  app.get("/assessments/:id", AnamnesisController.getAssessmentById);
}

```

# routes\appointment.routes.ts

```ts
// src/routes/appointment.routes.ts
import { FastifyInstance } from "fastify";
import { AppointmentController } from "../controllers/appointment.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export async function appointmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);
  app.post("/", AppointmentController.create);
  app.get("/patients", AppointmentController.listPatients);
  app.get("/appointment-types", AppointmentController.listAppointmentTypes);
  app.get("/treatment-plans/patient/:patientId", AppointmentController.listTreatmentPlansByPatient);
  app.patch("/:appointmentId/status", AppointmentController.updateStatus);
}

```

# routes\attendance.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { AttendanceController } from "../controllers/attendance.controller";

export async function attendanceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Main route for the attendance page
  app.get("/:appointmentId", AttendanceController.getAttendanceData);
  app.put("/:appointmentId", AttendanceController.saveDiagnosis);

  // Routes for attachments
  app.get(
    "/attachments/patient/:patientId",
    AttendanceController.listAttachments
  );
  app.post(
    "/attachments/signed-url",
    AttendanceController.createSignedUploadUrl
  );
  app.post("/attachments", AttendanceController.saveAttachment);
  app.delete(
    "/attachments/:attachmentId",
    AttendanceController.deleteAttachment
  );
  app.get(
    "/attachments/:attachmentId/download",
    AttendanceController.downloadAttachment
  );

  // Routes for before/after images
  app.get(
    "/before-after/:patientId",
    AttendanceController.getBeforeAfterImages
  );
  app.post(
    "/before-after/signed-url",
    AttendanceController.createBeforeAfterSignedUrl
  );
  app.post("/before-after", AttendanceController.saveBeforeAfterImage);
  app.patch("/before-after/:imageId", AttendanceController.updateAfterImage);
  app.delete(
    "/before-after/:imageId",
    AttendanceController.deleteBeforeAfterImage
  );
  app.get(
    "/before-after/:imageId/download",
    AttendanceController.downloadBeforeAfterImage
  );

  // Routes for documents (simplified)
  app.get("/documents/patient/:patientId", AttendanceController.listDocuments);
  app.post(
    "/documents/signed-url",
    AttendanceController.createDocumentSignedUrl
  );
  app.post("/documents", AttendanceController.saveDocument);
  app.delete("/documents/:documentId", AttendanceController.deleteDocument);
  app.get(
    "/documents/:documentId/download",
    AttendanceController.downloadDocument
  );

  app.get(
    "/documents/templates/:patientId",
    AttendanceController.getDocumentTemplates
  );
  app.post("/documents/generate", AttendanceController.generateDocument);

  app.put("/diagnosis/:appointmentId", AttendanceController.updateDiagnosis);
}

```

# routes\auth.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { AuthController } from "../controllers/auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", AuthController.login);
  app.post("/register", AuthController.register);
  app.post("/forgot-password", AuthController.forgotPassword);
  app.post("/reset-password", AuthController.resetPassword);
}

```

# routes\catalog.routes.ts

```ts
// src/routes/catalog.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { CatalogController } from "../controllers/catalog.controller";

export async function catalogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Rota genérica para os catálogos
  app.get("/:modelName", CatalogController.list);
  app.get("/:modelName/:id", CatalogController.getById);
  app.post("/:modelName", CatalogController.create);
  app.put("/:modelName/:id", CatalogController.update);
  app.delete("/:modelName/:id", CatalogController.delete);
}

```

# routes\commissionPlan.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { CommissionPlanController } from "../controllers/commissionPlan.controller";

export async function commissionPlanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", CommissionPlanController.create);
  app.get("/", CommissionPlanController.list);
  app.get("/:id", CommissionPlanController.getById);
  app.put("/:id", CommissionPlanController.update);
  app.delete("/:id", CommissionPlanController.delete);
}

```

# routes\commissionRecord.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { CommissionRecordController } from "../controllers/commissionRecord.controller";

export async function commissionRecordRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Endpoint para listar os registros de comissão
  app.get("/", CommissionRecordController.list);

  // Endpoint para marcar uma comissão como paga
  app.patch("/:id/pay", CommissionRecordController.markAsPaid);
}

```

# routes\dashboard.routes.ts

```ts
// src/routes/dashboard.routes.ts
import { FastifyInstance } from "fastify";
import { DashboardController } from "../controllers/dashboard.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export async function dashboardRoutes(app: FastifyInstance) {
  // Adiciona o hook 'preHandler' para executar o middleware em todas as rotas deste arquivo
  app.addHook("preHandler", authMiddleware);

  app.get("/professionals", DashboardController.getProfessionals);
  app.get("/appointments", DashboardController.getAppointments);
}
```

# routes\expense.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ExpenseController } from "../controllers/expense.controller";

export async function expenseRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ExpenseController.create);
  app.get("/", ExpenseController.list);
  app.get("/:id", ExpenseController.getById);
  app.put("/:id", ExpenseController.update);
  app.delete("/:id", ExpenseController.delete);

  // Rota para marcar uma despesa como paga
  app.patch("/:id/pay", ExpenseController.markAsPaid);
}

```

# routes\expenseCategory.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ExpenseCategoryController } from "../controllers/expenseCategory.controller";

export async function expenseCategoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ExpenseCategoryController.create);
  app.get("/", ExpenseCategoryController.list);
  app.get("/:id", ExpenseCategoryController.getById);
  app.put("/:id", ExpenseCategoryController.update);
  app.delete("/:id", ExpenseCategoryController.delete);
}

```

# routes\medicalReport.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { MedicalReportController } from "../controllers/medicalReport.controller";

export async function medicalReportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", MedicalReportController.create);
  app.get("/patient/:patientId", MedicalReportController.findByPatientId);
  app.put("/:reportId", MedicalReportController.update);
  app.delete("/:reportId", MedicalReportController.delete);
  app.get("/:reportId/download", MedicalReportController.downloadPdf);
}

```

# routes\patient.routes.ts

```ts
// src/routes/patient.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { PatientController } from "../controllers/patient.controller";

export async function patientRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", PatientController.create);
  app.get("/", PatientController.list);
  app.get("/:id", PatientController.getById);
  app.put("/:id", PatientController.update);
  app.delete("/:id", PatientController.delete);
}

```

# routes\paymentInstallment.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { PaymentInstallmentController } from "../controllers/paymentInstallment.controller";

export async function paymentInstallmentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Endpoint para registrar o pagamento de uma parcela específica
  app.patch("/:id/pay", PaymentInstallmentController.registerPayment);

  // Endpoint para listar as parcelas com filtros
  app.get("/", PaymentInstallmentController.list);

  // Endpoint para buscar uma parcela específica
  app.get("/:id", PaymentInstallmentController.getById);
}

```

# routes\prescription.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { PrescriptionController } from "../controllers/prescription.controller";

export async function prescriptionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", PrescriptionController.create);
  app.get("/patient/:patientId", PrescriptionController.findByPatientId);
  app.put("/:prescriptionId", PrescriptionController.update);
  app.delete("/:prescriptionId", PrescriptionController.delete);
  app.get("/:prescriptionId/download", PrescriptionController.downloadPdf);
}

```

# routes\product.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProductController } from "../controllers/product.controller";

export async function productRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProductController.create);
  app.get("/", ProductController.list);
  app.get("/:id", ProductController.getById);
  app.put("/:id", ProductController.update);
  app.delete("/:id", ProductController.delete);
}

```

# routes\productBrand.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProductBrandController } from "../controllers/productBrand.controller";

export async function productBrandRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProductBrandController.create);
  app.get("/", ProductBrandController.list);
  app.get("/:id", ProductBrandController.getById);
  app.put("/:id", ProductBrandController.update);
  app.delete("/:id", ProductBrandController.delete);
}

```

# routes\productCategory.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProductCategoryController } from "../controllers/productCategory.controller";

export async function productCategoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProductCategoryController.create);
  app.get("/", ProductCategoryController.list);
  app.get("/:id", ProductCategoryController.getById);
  app.put("/:id", ProductCategoryController.update);
  app.delete("/:id", ProductCategoryController.delete);
}

```

# routes\professionalCouncil.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { ProfessionalCouncilController } from "../controllers/professionalCouncil.controller";

export async function professionalCouncilRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", ProfessionalCouncilController.create);
  app.get("/", ProfessionalCouncilController.list);
  app.get("/:id", ProfessionalCouncilController.getById);
  app.put("/:id", ProfessionalCouncilController.update);
  app.delete("/:id", ProfessionalCouncilController.delete);
}

```

# routes\specialty.routes.ts

```ts
// src/routes/specialty.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { SpecialtyController } from "../controllers/specialty.controller";

export async function specialtyRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.get("/", SpecialtyController.list);
  app.get("/:id", SpecialtyController.getById);
  app.post("/", SpecialtyController.create);
  app.put("/:id", SpecialtyController.update);
  app.delete("/:id", SpecialtyController.delete);
}

```

# routes\specialtyTemplate.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { SpecialtyTemplateController } from "../controllers/specialtyTemplate.controller";

export async function specialtyTemplateRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Get available variables for templates
  app.get("/variables", SpecialtyTemplateController.getVariables);

  // CRUD routes
  app.post("/", SpecialtyTemplateController.create);
  app.get("/specialty/:specialtyId", SpecialtyTemplateController.findMany);
  app.get("/:templateId", SpecialtyTemplateController.findById);
  app.put("/:templateId", SpecialtyTemplateController.update);
  app.delete("/:templateId", SpecialtyTemplateController.delete);
}

```

# routes\stockMovement.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { StockMovementController } from "../controllers/stockMovement.controller";

export async function stockMovementRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", StockMovementController.create);
  app.get("/", StockMovementController.list);
  app.delete("/:id", StockMovementController.delete);
}

```

# routes\supplier.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { SupplierController } from "../controllers/supplier.controller";

export async function supplierRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", SupplierController.create);
  app.get("/", SupplierController.list);
  app.get("/:id", SupplierController.getById);
  app.put("/:id", SupplierController.update);
  app.delete("/:id", SupplierController.delete);
}

```

# routes\treatmentPlan.routes.ts

```ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { TreatmentPlanController } from "../controllers/treatmentPlan.controller";

export async function treatmentPlanRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", TreatmentPlanController.create);
  app.get("/", TreatmentPlanController.list);
  app.get("/:id", TreatmentPlanController.getById);
}

```

# routes\user.routes.ts

```ts
// src/routes/professional.routes.ts
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware";
import { UserController } from "../controllers/user.controller";

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  app.post("/", UserController.create);
  app.get("/", UserController.list);
  app.get("/:id", UserController.getById);
  app.put("/:id", UserController.update);
  app.delete("/:id", UserController.delete);
}

```

# schemas\anamnesis.schema.ts

```ts
import { z } from "zod";

const questionTypeEnum = z.enum([
  "YES_NO",
  "SHORT_TEXT",
  "LONG_TEXT",
  "SINGLE_SELECT",
  "MULTIPLE_SELECT",
  "SCALE",
  "DATE",
]);

const questionSchema: z.ZodType<any> = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1, "Pergunta é obrigatória"),
  description: z.string().optional().nullable(),
  type: questionTypeEnum,
  isRequired: z.boolean().default(false),
  order: z.number().int(),
  options: z.any().optional().nullable(),
  parentQuestionId: z.string().uuid().optional().nullable(),
  showCondition: z.any().optional().nullable(),
  subQuestions: z.lazy(() => z.array(questionSchema)).optional(),
});

const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Título da seção é obrigatório"),
  order: z.number().int(),
  questions: z.array(questionSchema),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Nome do template é obrigatório"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sections: z.array(sectionSchema),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createAssessmentSchema = z.object({
  templateId: z.string().uuid(),
  responses: z.record(z.string().uuid(), z.any()),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).default("IN_PROGRESS"),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

```

# schemas\appointment.schema.ts

```ts
// src/schemas/appointment.schema.ts
import { z } from "zod";

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  professionalId: z.string().uuid("ID do profissional inválido"),
  appointmentTypeId: z.string().uuid("ID do tipo de agendamento inválido"),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Formato de data inválido",
  }),
  startTime: z
    .string()
    .regex(
      /^([0-1]?\d|2[0-3]):[0-5]\d$/,
      "Formato de hora de início inválido (HH:MM)"
    ),
  endTime: z
    .string()
    .regex(
      /^([0-1]?\d|2[0-3]):[0-5]\d$/,
      "Formato de hora de fim inválido (HH:MM)"
    ),
  notes: z.string().optional().nullable(),
  treatmentPlanId: z.string().uuid().optional().nullable(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum([
    "SCHEDULED",
    "CONFIRMED",
    "CANCELED",
    "COMPLETED",
    "IN_PROGRESS",
  ]),
});

export const appointmentParamsSchema = z.object({
  appointmentId: z.string().uuid(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

```

# schemas\attendance.schema.ts

```ts
import { z } from "zod";

export const saveDiagnosisSchema = z.object({
  diagnosis: z.string().optional().nullable(),
});

export const createSignedUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  patientId: z.string().uuid(),
});

export const saveAttachmentSchema = z.object({
  patientId: z.string().uuid(),
  fileName: z.string().min(1),
  description: z.string().optional().nullable(),
  filePath: z.string().min(1),
  fileType: z.string().min(1),
  size: z.number().int().positive(),
});

export const attachmentParamsSchema = z.object({
  attachmentId: z.string().uuid(),
});

export const appointmentParamsSchema = z.object({
  appointmentId: z.string().uuid(),
});

export const patientParamsSchema = z.object({
  patientId: z.string().uuid(),
});

export const createBeforeAfterSignedUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  patientId: z.string().uuid(),
  imageType: z.enum(["before", "after"]),
});

export const saveBeforeAfterSchema = z.object({
  patientId: z.string().uuid(),
  treatmentPlanId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  beforeImagePath: z.string().min(1),
  afterImagePath: z.string().min(1).optional().nullable(),
});

export const updateAfterImageSchema = z.object({
  afterImagePath: z.string().min(1),
});

export const beforeAfterParamsSchema = z.object({
  imageId: z.string().uuid(),
});

export const listDocumentsQuerySchema = z.object({
  type: z.enum(["TERM", "CONTRACT"]),
});

export const createDocumentSignedUrlSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  patientId: z.string().uuid(),
  documentType: z.enum(["TERM", "CONTRACT"]),
});

export const saveDocumentSchema = z.object({
  patientId: z.string().uuid(),
  fileName: z.string().min(1),
  description: z.string().optional().nullable(),
  filePath: z.string().min(1),
  fileType: z.string().min(1),
  size: z.number().int().positive(),
  documentType: z.enum(["TERM", "CONTRACT"]),
});

export const documentParamsSchema = z.object({
  documentId: z.string().uuid(),
});

export const updateDiagnosisSchema = z.object({
  diagnosis: z.string().optional().nullable(),
});

```

# schemas\auth.schema.ts

```ts
import { z } from "zod";

// Schema de Login
export const loginSchema = z.object({
  email: z.string().email({ message: "Por favor, forneça um email válido." }),
  password: z
    .string()
    .min(6, { message: "A senha deve ter no mínimo 6 caracteres." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Schema de Cadastro
export const registerSchema = z.object({
  clinicName: z
    .string()
    .min(3, { message: "O nome da clínica deve ter no mínimo 3 caracteres." }),
  taxId: z.string().length(14, { message: "O CNPJ deve ter 14 dígitos." }), // CNPJ
  fullName: z.string().min(3, { message: "O nome completo é obrigatório." }),
  email: z.string().email({ message: "Por favor, forneça um email válido." }),
  password: z
    .string()
    .min(8, { message: "A senha deve ter no mínimo 8 caracteres." }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Por favor, forneça um email válido." }),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Schema para Redefinir a Senha
export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "O token é obrigatório." }),
  password: z
    .string()
    .min(8, { message: "A nova senha deve ter no mínimo 8 caracteres." }),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

```

# schemas\catalog.schema.ts

```ts
// src/schemas/catalog.schema.ts
import { RoleType } from "@prisma/client";
import { z } from "zod";

// Schema genérico para itens que só têm um nome
export const genericCatalogSchema = z.object({
  name: z
    .string()
    .min(2, { message: "O nome deve ter no mínimo 2 caracteres." }),
});

// Schema específico para Procedimentos, que tem mais campos
export const procedureSchema = z.object({
  name: z
    .string()
    .min(2, { message: "O nome deve ter no mínimo 2 caracteres." }),
  standardPrice: z.coerce
    .number()
    .min(0, { message: "O preço deve ser positivo." }),
  description: z.string().optional().nullable(),
  specialtyId: z.string().uuid({ message: "Especialidade inválida." }),
});

export const roleSchema = z.object({
  name: z
    .string()
    .min(2, { message: "O nome deve ter no mínimo 2 caracteres." }),
  description: z.string().optional().nullable(),
  type: z.nativeEnum(RoleType), // Valida contra o enum do Prisma
});

```

# schemas\commission.schema.ts

```ts
import { z } from "zod";

const CommissionTriggerEventEnum = z.enum([
  "ON_SALE",
  "ON_FIRST_INSTALLMENT_PAID",
  "ON_FULL_PLAN_PAID",
  "ON_EACH_INSTALLMENT_PAID",
]);

export const commissionTierSchema = z.object({
  minThreshold: z
    .number()
    .min(0, "O valor mínimo não pode ser negativo.")
    .refine((val) => val !== undefined && val !== null, {
      message: "O valor mínimo é obrigatório.",
    }),
  maxThreshold: z
    .number()
    .min(0, "O valor máximo não pode ser negativo.")
    .optional()
    .nullable(),
  percentage: z
    .number()
    .min(0, "A porcentagem não pode ser negativa.")
    .max(100, "A porcentagem não pode ser maior que 100.")
    .refine((val) => val !== undefined && val !== null, {
      message: "A porcentagem é obrigatória.",
    }),
});

export const createCommissionPlanSchema = z.object({
  name: z
    .string()
    .min(3, "O nome do plano deve ter no mínimo 3 caracteres.")
    .refine((val) => !!val, {
      message: "O nome do plano é obrigatório.",
    }),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  triggerEvent: CommissionTriggerEventEnum.default("ON_FULL_PLAN_PAID"),
  tiers: z
    .array(commissionTierSchema)
    .min(1, "O plano deve ter ao menos uma faixa de comissão."),
});

export const updateCommissionPlanSchema = createCommissionPlanSchema.partial();

export type CreateCommissionPlanInput = z.infer<
  typeof createCommissionPlanSchema
>;
export type UpdateCommissionPlanInput = z.infer<
  typeof updateCommissionPlanSchema
>;

```

# schemas\commissionRecord.schema.ts

```ts
import { z } from "zod";

// Schema para marcar uma comissão como paga
export const markCommissionAsPaidSchema = z.object({
  paymentDate: z
    .string({ message: "A data do pagamento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
});

export type MarkCommissionAsPaidInput = z.infer<
  typeof markCommissionAsPaidSchema
>;

```

# schemas\expense.schema.ts

```ts
import { z } from "zod";

export const createExpenseSchema = z.object({
  description: z
    .string({ message: "A descrição é obrigatória." })
    .min(3, { message: "Descrição muito curta." }),
  amount: z.coerce.number().positive({ message: "O valor deve ser positivo." }),
  dueDate: z
    .string({ message: "A data de vencimento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
  supplierId: z.preprocess(
    (val) => (val === "" ? null : val),
    z
      .string()
      .uuid({ message: "ID do fornecedor inválido." })
      .optional()
      .nullable()
  ),
  categoryId: z.preprocess(
    (val) => (val === "" ? null : val),
    z
      .string()
      .uuid({ message: "ID da categoria inválida." })
      .optional()
      .nullable()
  ),
  notes: z.string().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const markExpenseAsPaidSchema = z.object({
  paymentDate: z
    .string({ message: "A data do pagamento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
  bankAccountId: z
    .string({ message: "A conta de destino é obrigatória." })
    .uuid({ message: "Conta inválida." }),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type MarkExpenseAsPaidInput = z.infer<typeof markExpenseAsPaidSchema>;

```

# schemas\expenseCategory.schema.ts

```ts
import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z
    .string({ message: "O nome é obrigatório." })
    .min(2, { message: "Nome muito curto." }),
});

export const updateExpenseCategorySchema =
  createExpenseCategorySchema.partial();

export type CreateExpenseCategoryInput = z.infer<
  typeof createExpenseCategorySchema
>;
export type UpdateExpenseCategoryInput = z.infer<
  typeof updateExpenseCategorySchema
>;

```

# schemas\medicalReport.schema.ts

```ts
import { z } from "zod";

export const reportParamsSchema = z.object({
  reportId: z.string().uuid(),
});

export const patientParamsSchema = z.object({
  patientId: z.string().uuid(),
});

export const createReportSchema = z.object({
  content: z.string().min(1, "O conteúdo é obrigatório."),
  patientId: z.string().uuid(),
  professionalId: z.string().uuid(),
});

export const updateReportSchema = z.object({
  content: z.string().min(1, "O conteúdo é obrigatório.").optional(),
});

```

# schemas\patient.schema.ts

```ts
// src/schemas/patient.schema.ts
import { z } from "zod";

const phoneSchema = z.object({
  number: z.string().min(10, "Número inválido."),
  isWhatsapp: z.boolean(),
});

const addressSchema = z.object({
  zipCode: z.string().length(8, "CEP inválido."),
  street: z.string().min(1, "Rua é obrigatória."),
  number: z.string().min(1, "Número é obrigatório."),
  neighborhood: z.string().min(1, "Bairro é obrigatório."),
  city: z.string().min(1, "Cidade é obrigatória."),
  state: z.string().min(1, "Estado é obrigatório."),
  complement: z.string().optional().nullable(), // Já estava correto
});

export const createPatientSchema = z.object({
  // CORREÇÃO: Adicionar .nullable() a todos os campos de texto opcionais
  imageUrl: z.string().optional().nullable(),
  name: z.string().min(3, "Nome completo é obrigatório."),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos."),
  birthDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Data de nascimento inválida."),
  socialName: z.string().optional().nullable(),
  identityCard: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  ethnicity: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),

  phones: z.array(phoneSchema).min(1, "Pelo menos um telefone é obrigatório."),
  address: addressSchema,

  trafficSourceId: z
    .string()
    .uuid("Fonte de tráfego inválida.")
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),

  guardianName: z.string().optional().nullable(),
  guardianBirthDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Data inválida.")
    .optional()
    .nullable(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

```

# schemas\paymentInstallment.schema.ts

```ts
import { z } from "zod";

// Enum deve espelhar o do Prisma, mas usamos aqui para validação
const PaymentMethod = z.enum([
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BANK_TRANSFER",
  "CASH",
  "CHECK",
  "OTHER",
]);

// Schema para registrar o pagamento de uma parcela
export const registerPaymentSchema = z.object({
  paidAmount: z.coerce
    .number()
    .positive({ message: "O valor pago deve ser positivo." }),
  paymentDate: z
    .string({ message: "A data do pagamento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
  paymentMethod: PaymentMethod.refine((val) => !!val, {
    message: "O método de pagamento é obrigatório.",
  }),
  notes: z.string().optional().nullable(),
  bankAccountId: z
    .string({ message: "A conta de destino é obrigatória." })
    .uuid({ message: "Conta inválida." }),
});

export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

```

# schemas\prescription.schema.ts

```ts
import { z } from "zod";

export const prescriptionParamsSchema = z.object({
  prescriptionId: z.string().uuid(),
});

export const patientParamsSchema = z.object({
  patientId: z.string().uuid(),
});

export const createPrescriptionSchema = z.object({
  content: z.string().min(1, "O conteúdo é obrigatório."),
  patientId: z.string().uuid(),
  professionalId: z.string().uuid(),
});

export const updatePrescriptionSchema = z.object({
  content: z.string().min(1, "O conteúdo é obrigatório.").optional(),
});

```

# schemas\product.schema.ts

```ts
import { z } from "zod";

export const createProductSchema = z.object({
  name: z
    .string()
    .min(2, "O nome do produto deve ter no mínimo 2 caracteres.")
    .refine((val) => val.trim().length > 0, {
      message: "O nome do produto é obrigatório.",
    }),

  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),

  categoryId: z
    .string()
    .uuid("ID da categoria inválido.")
    .refine((val) => val.trim().length > 0, {
      message: "A categoria é obrigatória.",
    }),

  brandId: z
    .string()
    .uuid("ID da marca inválido.")
    .refine((val) => val.trim().length > 0, {
      message: "A marca é obrigatória.",
    }),

  lowStockThreshold: z
    .number()
    .int("O limiar de estoque baixo deve ser um número inteiro.")
    .min(0, "O limiar não pode ser negativo.")
    .optional()
    .nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

```

# schemas\productBrand.schema.ts

```ts
import { z } from "zod";

export const createProductBrandSchema = z.object({
  name: z
    .string({ error: "O nome da marca é obrigatório." })
    .min(2, "O nome da marca deve ter no mínimo 2 caracteres.")
    .nonoptional(),
  description: z.string().optional().nullable(),
});

export const updateProductBrandSchema = createProductBrandSchema.partial();

export type CreateProductBrandInput = z.infer<typeof createProductBrandSchema>;
export type UpdateProductBrandInput = z.infer<typeof updateProductBrandSchema>;

```

# schemas\productCategory.schema.ts

```ts
import { z } from "zod";

export const createProductCategorySchema = z.object({
  name: z
    .string({ error: "O nome da categoria é obrigatório." })
    .min(2, "O nome da categoria deve ter no mínimo 2 caracteres.")
    .nonoptional(),
  description: z.string().optional().nullable(),
});

export const updateProductCategorySchema =
  createProductCategorySchema.partial();

export type CreateProductCategoryInput = z.infer<
  typeof createProductCategorySchema
>;
export type UpdateProductCategoryInput = z.infer<
  typeof updateProductCategorySchema
>;

```

# schemas\professionalCouncil.schema.ts

```ts
import { z } from "zod";

export const createProfessionalCouncilSchema = z.object({
  name: z.string().min(2, "O nome do conselho é obrigatório."),
  description: z.string().optional().nullable(),
});

export const updateProfessionalCouncilSchema =
  createProfessionalCouncilSchema.partial();

export type CreateProfessionalCouncilInput = z.infer<
  typeof createProfessionalCouncilSchema
>;
export type UpdateProfessionalCouncilInput = z.infer<
  typeof updateProfessionalCouncilSchema
>;

```

# schemas\specialty.schema.ts

```ts
// src/schemas/specialty.schema.ts
import { z } from "zod";

export const specialtySchema = z.object({
  name: z
    .string()
    .min(2, { message: "O nome deve ter no mínimo 2 caracteres." }),
  professionalIds: z.array(z.string().uuid()).optional(),
});

```

# schemas\specialtyTemplate.schema.ts

```ts
import { z } from "zod";
import { DocumentType } from "@prisma/client";

export const createTemplateSchema = z.object({
  name: z.string().min(3, "O nome é obrigatório."),
  content: z.string().min(10, "O conteúdo é obrigatório."),
  type: z.nativeEnum(DocumentType),
  specialtyId: z.string().uuid(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(3).optional(),
  content: z.string().min(10).optional(),
  isActive: z.boolean().optional(),
});

export const templateParamsSchema = z.object({
  templateId: z.string().uuid(),
});

export const specialtyParamsSchema = z.object({
  specialtyId: z.string().uuid(),
});

export const listTemplatesQuerySchema = z.object({
  type: z.nativeEnum(DocumentType).optional(),
});

```

# schemas\stockMovement.schema.ts

```ts
import { z } from "zod";

const StockMovementType = z.enum(["ENTRY", "EXIT"]);

export const createStockMovementSchema = z.object({
  productId: z
    .string({ message: "O produto é obrigatório." })
    .uuid({ message: "ID do produto inválido." }),
  type: StockMovementType,
  quantity: z.coerce
    .number()
    .int({ message: "A quantidade deve ser um número inteiro." })
    .positive({ message: "A quantidade deve ser maior que zero." }),
  date: z
    .string({ message: "A data é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),

  totalValue: z.coerce
    .number()
    .positive({ message: "O valor deve ser positivo." })
    .optional()
    .nullable(),
  invoiceNumber: z.string().optional().nullable(),

  supplierId: z.preprocess(
    (val) => (val === "" ? null : val),
    z
      .string()
      .uuid({ message: "ID do fornecedor inválido." })
      .optional()
      .nullable()
  ),

  notes: z.string().optional().nullable(),
});

export const updateStockMovementSchema = createStockMovementSchema.partial();
export type CreateStockMovementInput = z.infer<
  typeof createStockMovementSchema
>;

```

# schemas\supplier.schema.ts

```ts
import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z
    .string({ error: "O nome do fornecedor é obrigatório." })
    .min(2, "O nome do fornecedor deve ter no mínimo 2 caracteres.")
    .nonoptional(),
  description: z.string().optional().nullable(),
  // Campos extras que podem ser úteis
  // taxId: z.string().optional().nullable(), // CNPJ
  // email: z.string().email("Email inválido.").optional().nullable(),
  // phone: z.string().optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

```

# schemas\treatmentPlan.schema.ts

```ts
// src/schemas/treatmentPlan.schema.ts
import { z } from "zod";

const procedureItemSchema = z.object({
  procedureId: z.string().uuid(),
  unitPrice: z.coerce.number(),
  contractedSessions: z.coerce.number().int().min(1),
  followUps: z.coerce.number().int().min(0).default(0),
});

const paymentTermsSchema = z.object({
  numberOfInstallments: z.coerce
    .number()
    .int()
    .min(1, "Deve haver pelo menos 1 parcela.")
    .max(12, "Máximo de 12 parcelas."), // Limite de 12
  firstDueDate: z
    .string()
    .refine(
      (d) => !Number.isNaN(Date.parse(d)),
      "Data da primeira parcela inválida."
    )
    .optional()
    .nullable(),
});

export const createTreatmentPlanSchema = z.object({
  patientId: z.string().uuid("Paciente inválido."),
  sellerId: z.string().uuid("Vendedor inválido."),
  subtotal: z.coerce.number(),
  discountAmount: z.coerce.number().optional().nullable(),
  total: z.coerce.number(),
  procedures: z
    .array(procedureItemSchema)
    .min(1, "Adicione pelo menos um procedimento."),
  paymentTerms: paymentTermsSchema,
});

export type CreateTreatmentPlanInput = z.infer<
  typeof createTreatmentPlanSchema
>;

```

# schemas\user.schema.ts

```ts
import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z.string().min(3, "Nome completo é obrigatório."),
  email: z.string().email("Email inválido."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
  roleId: z.string().uuid("O papel é obrigatório."),
  isProfessional: z.boolean(),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos.").optional().nullable(),
  phone: z.string().min(10, "Telefone inválido.").optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
    .optional()
    .nullable(),
  scheduleStartHour: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  scheduleEndHour: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  appointmentDuration: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  specialtyIds: z.array(z.string().uuid()).optional(),

  // --- CAMPOS ADICIONADOS ---
  commissionPlanId: z
    .string()
    .uuid("Plano de comissão inválido.")
    .optional()
    .nullable(),
  professionalCouncilId: z
    .string()
    .uuid("Conselho profissional inválido.")
    .optional()
    .nullable(),
  professionalCouncilRegistry: z
    .string()
    .min(1, "O número de registro é obrigatório se o conselho for selecionado.")
    .optional()
    .nullable(),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial();

```

# server.ts

```ts
import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;

app.listen({
  host: '0.0.0.0', 
  port: PORT,
}).then(() => {
  console.log(`🚀 Servidor HTTP rodando na porta ${PORT}`);
});
```

# services\anamnesis.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateAssessmentInput,
} from "../schemas/anamnesis.schema";

export class AnamnesisService {
  private static async createQuestionWithSubQuestions(
    tx: Prisma.TransactionClient,
    sectionId: string,
    questionData: any,
    parentQuestionId: string | null
  ) {
    const { subQuestions, ...question } = questionData;

    const createdQuestion = await tx.anamnesisQuestion.create({
      data: {
        ...question,
        sectionId,
        parentQuestionId,
        options: question.options ? question.options : undefined,
      },
    });

    if (subQuestions && subQuestions.length > 0) {
      for (const subQuestion of subQuestions) {
        await this.createQuestionWithSubQuestions(
          tx,
          sectionId,
          subQuestion,
          createdQuestion.id
        );
      }
    }

    return createdQuestion;
  }

  static async createTemplate(clinicId: string, data: CreateTemplateInput) {
    const { sections, ...templateData } = data;

    return prisma.$transaction(async (tx) => {
      const template = await tx.anamnesisTemplate.create({
        data: {
          ...templateData,
          clinicId,
        },
      });

      for (const section of sections) {
        const { questions, ...sectionData } = section;

        const createdSection = await tx.anamnesisSection.create({
          data: {
            ...sectionData,
            templateId: template.id,
          },
        });

        for (const question of questions) {
          await this.createQuestionWithSubQuestions(
            tx,
            createdSection.id,
            question,
            null
          );
        }
      }

      return template;
    });
  }

  static async listTemplates(clinicId: string) {
    return prisma.anamnesisTemplate.findMany({
      where: { clinicId },
      include: {
        _count: {
          select: {
            sections: true,
            assessments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getTemplateById(id: string, clinicId: string) {
    const template = await prisma.anamnesisTemplate.findFirst({
      where: { id, clinicId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              where: { parentQuestionId: null },
              orderBy: { order: "asc" },
              include: {
                subQuestions: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!template) return null;

    const nestSubQuestions = (questions: any[]): any[] => {
      return questions.map((q) => ({
        ...q,
        subQuestions: q.subQuestions ? nestSubQuestions(q.subQuestions) : [],
      }));
    };

    template.sections.forEach((section) => {
      section.questions = nestSubQuestions(section.questions);
    });

    return template;
  }

  static async updateTemplate(
    id: string,
    clinicId: string,
    data: UpdateTemplateInput
  ) {
    const template = await prisma.anamnesisTemplate.findFirst({
      where: { id, clinicId },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    const { sections, ...templateData } = data;

    return prisma.$transaction(async (tx) => {
      const updatedTemplate = await tx.anamnesisTemplate.update({
        where: { id },
        data: templateData,
      });

      if (sections) {
        await tx.anamnesisSection.deleteMany({
          where: { templateId: id },
        });

        for (const section of sections) {
          const { questions, ...sectionData } = section;

          const createdSection = await tx.anamnesisSection.create({
            data: {
              ...sectionData,
              templateId: id,
            },
          });

          for (const question of questions) {
            await this.createQuestionWithSubQuestions(
              tx,
              createdSection.id,
              question,
              null
            );
          }
        }
      }

      return updatedTemplate;
    });
  }

  static async deleteTemplate(id: string, clinicId: string) {
    const template = await prisma.anamnesisTemplate.findFirst({
      where: { id, clinicId },
      include: {
        _count: {
          select: { assessments: true },
        },
      },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    if (template._count.assessments > 0) {
      throw new Error("Cannot delete template with existing assessments");
    }

    return prisma.anamnesisTemplate.delete({
      where: { id },
    });
  }

  private static mapQuestionForDuplication(question: any): any {
    return {
      question: question.question,
      description: question.description,
      type: question.type,
      isRequired: question.isRequired,
      order: question.order,
      options: question.options,
      showCondition: question.showCondition,
      subQuestions:
        question.subQuestions?.map((sq: any) =>
          this.mapQuestionForDuplication(sq)
        ) || [],
    };
  }

  static async duplicateTemplate(id: string, clinicId: string) {
    const originalTemplate = await this.getTemplateById(id, clinicId);

    if (!originalTemplate) {
      throw new Error("Template not found");
    }

    const templateData = {
      name: `${originalTemplate.name} (Cópia)`,
      description: originalTemplate.description,
      isActive: originalTemplate.isActive,
      sections: originalTemplate.sections.map((section) => ({
        title: section.title,
        order: section.order,
        questions: section.questions.map((question) =>
          this.mapQuestionForDuplication(question)
        ),
      })),
    };

    return this.createTemplate(clinicId, templateData as CreateTemplateInput);
  }

  static async createOrUpdateAssessment(
    appointmentId: string,
    professionalId: string,
    clinicId: string,
    data: CreateAssessmentInput
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { patientId: true },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    return prisma.patientAssessment.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        patientId: appointment.patientId,
        templateId: data.templateId,
        professionalId,
        clinicId,
        status: data.status,
        completedAt: data.status === "COMPLETED" ? new Date() : null,
        responses: {
          create: Object.entries(data.responses).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        },
      },
      update: {
        status: data.status,
        completedAt: data.status === "COMPLETED" ? new Date() : null,
        responses: {
          deleteMany: {},
          create: Object.entries(data.responses).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        },
      },
    });
  }

  static async getAssessmentByAppointment(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        appointmentType: true,
        professional: true,
        assessment: {
          include: {
            template: {
              include: {
                sections: {
                  include: {
                    questions: {
                      where: { parentQuestionId: null },
                      orderBy: { order: "asc" },
                      include: {
                        subQuestions: true,
                      },
                    },
                  },
                  orderBy: { order: "asc" },
                },
              },
            },
            responses: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const responsesMap = appointment.assessment
      ? appointment.assessment.responses.reduce((acc, response) => {
          acc[response.questionId] = response.value;
          return acc;
        }, {} as Record<string, any>)
      : {};

    let template = appointment.assessment?.template;
    if (!template) {
      const clinicId = appointment.professional.clinicId;
      const foundTemplate = await prisma.anamnesisTemplate.findFirst({
        where: {
          clinicId,
          isActive: true,
        },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              questions: {
                where: { parentQuestionId: null },
                orderBy: { order: "asc" },
                include: {
                  subQuestions: true,
                },
              },
            },
          },
        },
      });
      template = foundTemplate ?? undefined;
    }

    return {
      id: appointment.assessment?.id,
      status: appointment.assessment?.status,
      patient: appointment.patient,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        appointmentType: appointment.appointmentType,
        professional: appointment.professional,
      },
      template,
      responses: responsesMap,
    };
  }

  static async listPatientAssessments(patientId: string) {
    return prisma.patientAssessment.findMany({
      where: { patientId },
      include: {
        appointment: {
          select: {
            id: true,
            date: true,
            appointmentType: { select: { name: true } },
            professional: { select: { fullName: true } },
          },
        },
        template: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getAssessmentById(id: string) {
    const assessment = await prisma.patientAssessment.findUnique({
      where: { id },
      include: {
        template: { select: { name: true } },
        responses: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!assessment) return null;

    const allQuestions = await prisma.anamnesisQuestion.findMany({
      where: {
        section: {
          templateId: assessment.templateId,
        },
      },
      orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
    });

    return {
      ...assessment,
      allQuestions,
    };
  }
}

```

# services\appointment.service.ts

```ts
import { prisma } from "../lib/prisma";
import { CreateAppointmentInput } from "../schemas/appointment.schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Custom Error class for better error handling
class SessionLimitError extends Error {
  scheduledDates: string[];
  constructor(message: string, scheduledDates: string[]) {
    super(message);
    this.name = "SessionLimitError";
    this.scheduledDates = scheduledDates;
  }
}

export class AppointmentService {
  static async updateStatus(
    appointmentId: string,
    status: "SCHEDULED" | "CONFIRMED" | "CANCELED" | "COMPLETED" | "IN_PROGRESS"
  ) {
    // Use a transaction to ensure both appointment and session count are updated together
    return prisma.$transaction(async (tx) => {
      // 1. Get the current state of the appointment before updating
      const currentAppointment = await tx.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
        select: { status: true, treatmentPlanId: true },
      });

      const oldStatus = currentAppointment.status;
      const { treatmentPlanId } = currentAppointment;

      // 2. Update the appointment status
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: { status },
      });

      // 3. If it's linked to a treatment plan, update the completed session count
      if (treatmentPlanId) {
        // Find the specific procedure within the plan this appointment is for
        // NOTE: This assumes the plan has one main procedure. For multi-procedure plans,
        // you might need to link appointments to a `treatmentPlanProcedureId` directly.
        const planProcedure = await tx.treatmentPlanProcedure.findFirst({
          where: { treatmentPlanId: treatmentPlanId },
        });

        if (planProcedure) {
          // Increment count if moving TO completed
          if (status === "COMPLETED" && oldStatus !== "COMPLETED") {
            await tx.treatmentPlanProcedure.update({
              where: { id: planProcedure.id },
              data: { completedSessions: { increment: 1 } },
            });
          }
          // Decrement count if moving FROM completed
          else if (status !== "COMPLETED" && oldStatus === "COMPLETED") {
            await tx.treatmentPlanProcedure.update({
              where: { id: planProcedure.id },
              data: { completedSessions: { decrement: 1 } },
            });
          }
        }
      }

      return updatedAppointment;
    });
  }

  static async create(clinicId: string, data: CreateAppointmentInput) {
    // --- NEW VALIDATION LOGIC STARTS HERE ---
    if (data.treatmentPlanId) {
      // Find the procedure within the plan to get session limits
      const planProcedure = await prisma.treatmentPlanProcedure.findFirst({
        where: { treatmentPlanId: data.treatmentPlanId },
      });

      if (planProcedure) {
        // Count existing appointments for this plan that are NOT canceled
        const existingAppointments = await prisma.appointment.findMany({
          where: {
            treatmentPlanId: data.treatmentPlanId,
            NOT: {
              status: "CANCELED",
            },
          },
          select: { date: true, startTime: true },
        });

        // Check if the number of scheduled sessions is already at the limit
        if (existingAppointments.length >= planProcedure.contractedSessions) {
          const scheduledDates = existingAppointments.map((apt) =>
            format(new Date(apt.date), "dd/MM/yyyy", { locale: ptBR })
          );
          throw new SessionLimitError(
            `Todas as ${planProcedure.contractedSessions} sessões contratadas já foram agendadas.`,
            scheduledDates
          );
        }
      }
    }
    // --- NEW VALIDATION LOGIC ENDS HERE ---

    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        professionalId: data.professionalId,
        appointmentTypeId: data.appointmentTypeId,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
        date: new Date(data.date),
        treatmentPlanId: data.treatmentPlanId,
      },
    });

    return appointment;
  }

  static async listPatients(clinicId: string) {
    return prisma.patient.findMany({
      where: { clinicId },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  static async listAppointmentTypes() {
    return prisma.appointmentType.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  static async listTreatmentPlansByPatient(
    clinicId: string,
    patientId: string
  ) {
    return prisma.treatmentPlan.findMany({
      where: { clinicId, patientId },
      include: {
        procedures: {
          include: {
            procedure: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

```

# services\attendance.service.ts

```ts
import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import { randomUUID } from "crypto";
import {
  saveAttachmentSchema,
  saveBeforeAfterSchema,
} from "../schemas/attendance.schema";
import { z } from "zod";
import { DocumentType } from "@prisma/client";
import { substituteVariables } from "../lib/templateVariables";
import PdfService from "./pdf.service";

const ATTACHMENTS_BUCKET = "attachments";
const BEFORE_AFTER_BUCKET = "before-after";
const DOCUMENTS_BUCKET = "documents";

export class AttendanceService {
  static async getTemplatesForPatient(
    patientId: string,
    type: DocumentType
  ): Promise<any[]> {
    // Get patient's treatment plan to find specialty
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      include: {
        treatmentPlans: {
          include: {
            procedures: {
              include: {
                procedure: {
                  include: {
                    specialty: {
                      include: {
                        templates: {
                          where: {
                            type,
                            isActive: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!patient.treatmentPlans.length) {
      return [];
    }

    const specialty =
      patient.treatmentPlans[0].procedures[0]?.procedure?.specialty;

    if (!specialty) {
      return [];
    }

    return specialty.templates || [];
  }

  static async generateDocumentFromTemplate(data: {
    patientId: string;
    templateId: string;
    clinicId: string;
  }) {
    // Get template
    const template = await prisma.specialtyTemplate.findUniqueOrThrow({
      where: { id: data.templateId },
      include: { specialty: true },
    });

    // Get patient data
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: data.patientId },
      include: {
        address: true,
        phones: true,
        treatmentPlans: {
          include: {
            procedures: {
              include: {
                procedure: {
                  include: {
                    specialty: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Get clinic data
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: data.clinicId },
      include: { address: true },
    });

    // Prepare treatment plan data
    let treatmentPlanData = null;
    if (patient.treatmentPlans.length > 0) {
      const plan = patient.treatmentPlans[0];
      const procedure = plan.procedures[0];
      treatmentPlanData = {
        specialty: procedure?.procedure?.specialty?.name,
        procedure: procedure?.procedure?.name,
        sessions: procedure?.contractedSessions,
        total: plan.total,
      };
    }

    // Substitute variables in template
    const filledContent = substituteVariables(template.content, {
      patient,
      clinic,
      treatmentPlan: treatmentPlanData,
    });

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${template.type.toLowerCase()}_${patient.name.replace(
      / /g,
      "_"
    )}_${timestamp}.pdf`;
    const filePath = `${data.clinicId}/${data.patientId}/${fileName}`;

    // Generate PDF
    const pdfBuffer = await this.generatePDFFromHTML(
      filledContent,
      clinic,
      template.name
    );

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      throw new Error("Could not upload generated document");
    }

    // Save to database
    const document = await prisma.patientDocument.create({
      data: {
        patientId: data.patientId,
        templateId: data.templateId,
        fileName,
        filePath,
        fileType: "application/pdf",
        size: pdfBuffer.length,
        type: template.type,
        status: "PENDING",
      },
    });

    return document;
  }

  private static async generatePDFFromHTML(
    content: string,
    clinic: any,
    documentTitle: string
  ): Promise<Buffer> {
    const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
      <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
      ${
        clinic.address
          ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>`
          : ""
      }
      <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
    </div>
  `;

    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 2cm 1.5cm;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

    const pdfBuffer = await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
      margin: { top: "120px", bottom: "60px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }

  static async getAttendanceData(appointmentId: string, clinicId: string) {
    const appointment = await prisma.appointment.findFirstOrThrow({
      where: { id: appointmentId, patient: { clinicId } },
      include: {
        patient: true,
        professional: { select: { fullName: true } },
        treatmentPlan: {
          include: {
            procedures: {
              include: {
                procedure: {
                  include: {
                    specialty: true,
                  },
                },
              },
            },
          },
        },
        clinicalRecord: true,
      },
    });

    const assessments = await prisma.patientAssessment.findMany({
      where: { patientId: appointment.patient.id },
      include: {
        template: true,
        appointment: {
          include: {
            appointmentType: true,
          },
        },
        professional: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const patientHistory = await prisma.appointment.findMany({
      where: { patientId: appointment.patient.id },
      include: {
        appointmentType: true,
        professional: true,
        assessment: { select: { id: true } },
        clinicalRecord: true,
      },
      orderBy: { date: "desc" },
    });

    const beforeAfterImages = await prisma.beforeAfterImage.findMany({
      where: { patientId: appointment.patient.id },
      orderBy: { createdAt: "desc" },
    });

    const imagesWithUrls = await Promise.all(
      beforeAfterImages.map(async (image) => {
        const { data: beforeData } = await supabase.storage
          .from(BEFORE_AFTER_BUCKET)
          .createSignedUrl(image.beforeImagePath, 60 * 5);

        let afterSignedUrl = null;
        if (image.afterImagePath) {
          const { data: afterData } = await supabase.storage
            .from(BEFORE_AFTER_BUCKET)
            .createSignedUrl(image.afterImagePath, 60 * 5);
          afterSignedUrl = afterData?.signedUrl ?? null;
        }

        return {
          ...image,
          beforeImagePath: beforeData?.signedUrl ?? "",
          afterImagePath: afterSignedUrl,
        };
      })
    );

    return {
      ...appointment,
      assessments,
      patientHistory,
      patient: {
        ...appointment.patient,
        beforeAfterImages: imagesWithUrls,
      },
    };
  }

  static async saveDiagnosis(
    appointmentId: string,
    diagnosis: string | null | undefined
  ) {
    return prisma.clinicalRecord.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        diagnosis: diagnosis || "",
      },
      update: {
        diagnosis: diagnosis || "",
      },
    });
  }

  static async listAttachments(patientId: string) {
    const attachments = await prisma.attachment.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        let viewUrl: string | null = null;
        if (attachment.fileType.startsWith("image/")) {
          const { data } = await supabase.storage
            .from(ATTACHMENTS_BUCKET)
            .createSignedUrl(attachment.filePath, 60 * 5);
          viewUrl = data?.signedUrl ?? null;
        }
        return { ...attachment, viewUrl };
      })
    );
    return attachmentsWithUrls;
  }

  static async createSignedUploadUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    // ================= FIX IS HERE =================
    // The second argument `60` is removed. The function no longer takes an expiration time.
    // It uses a default expiration set by Supabase (usually one hour).
    const { data: signedUrlData, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error:", error);
      throw new Error("Could not create signed upload URL");
    }
    // ===============================================

    return { ...signedUrlData, filePath };
  }

  static async saveAttachment(data: z.infer<typeof saveAttachmentSchema>) {
    return prisma.attachment.create({
      data: {
        patientId: data.patientId,
        fileName: data.fileName,
        description: data.description,
        filePath: data.filePath,
        fileType: data.fileType,
        size: data.size,
      },
    });
  }

  static async deleteAttachment(attachmentId: string, clinicId: string) {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: {
        id: attachmentId,
        patient: { clinicId },
      },
    });

    const { error: storageError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([attachment.filePath]);

    if (storageError) {
      // Log the error but don't block DB deletion if file is already gone
      console.error("Supabase storage deletion error:", storageError.message);
    }

    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // ================= FIX IS HERE =================
    // The redundant "return;" has been removed.
    // ===============================================
  }

  static async getBeforeAfterImages(patientId: string) {
    const images = await prisma.beforeAfterImage.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        const { data: beforeData } = await supabase.storage
          .from(BEFORE_AFTER_BUCKET)
          .createSignedUrl(image.beforeImagePath, 60 * 5);

        let afterSignedUrl: string | null = null;
        if (image.afterImagePath) {
          const { data: afterData } = await supabase.storage
            .from(BEFORE_AFTER_BUCKET)
            .createSignedUrl(image.afterImagePath, 60 * 5);
          afterSignedUrl = afterData?.signedUrl ?? null;
        }

        return {
          ...image,
          beforeImageSignedUrl: beforeData?.signedUrl ?? null,
          afterImageSignedUrl: afterSignedUrl,
        };
      })
    );
    return imagesWithUrls;
  }

  static async getBeforeAfterDownloadUrl(
    imageId: string,
    type: "before" | "after",
    clinicId: string
  ) {
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: { id: imageId, patient: { clinicId } },
    });

    const filePath =
      type === "before" ? image.beforeImagePath : image.afterImagePath;

    if (!filePath) {
      throw new Error(`Image type '${type}' not found.`);
    }

    const { data, error } = await supabase.storage
      .from(BEFORE_AFTER_BUCKET)
      .createSignedUrl(filePath, 3600, {
        download: `${type}-${image.id}.jpg`,
      });

    if (error || !data) {
      throw new Error("Could not generate download URL");
    }
    return { signedUrl: data.signedUrl };
  }

  static async createBeforeAfterSignedUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
    imageType: "before" | "after";
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${data.imageType}-${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    const { data: signedUrlData, error } = await supabase.storage
      .from(BEFORE_AFTER_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error (before-after):", error);
      throw new Error(
        "Could not create signed upload URL for before/after image"
      );
    }

    return { ...signedUrlData, filePath };
  }

  static async saveBeforeAfterImage(
    data: z.infer<typeof saveBeforeAfterSchema>
  ) {
    return prisma.beforeAfterImage.create({
      data: {
        patientId: data.patientId,
        treatmentPlanId: data.treatmentPlanId,
        description: data.description,
        beforeImagePath: data.beforeImagePath,
        afterImagePath: data.afterImagePath,
      },
    });
  }

  static async updateAfterImage(imageId: string, afterImagePath: string) {
    return prisma.beforeAfterImage.update({
      where: { id: imageId },
      data: { afterImagePath },
    });
  }

  static async deleteBeforeAfterImage(imageId: string, clinicId: string) {
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: {
        id: imageId,
        patient: { clinicId }, // Garante que a imagem pertence à clínica do usuário
      },
    });

    const filesToRemove = [image.beforeImagePath];
    if (image.afterImagePath) {
      filesToRemove.push(image.afterImagePath);
    }

    await supabase.storage.from(BEFORE_AFTER_BUCKET).remove(filesToRemove);

    await prisma.beforeAfterImage.delete({
      where: { id: imageId },
    });
  }

  // List documents by patient and type
  static async listDocuments(patientId: string, type: DocumentType) {
    const documents = await prisma.patientDocument.findMany({
      where: {
        patientId,
        type,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return documents;
  }

  // Create signed URL for document upload
  static async createDocumentSignedUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
    documentType: DocumentType;
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${data.documentType.toLowerCase()}-${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    const { data: signedUrlData, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error (documents):", error);
      throw new Error("Could not create signed upload URL for document");
    }

    return { ...signedUrlData, filePath };
  }

  // Save document metadata to database
  static async saveDocument(data: {
    patientId: string;
    fileName: string;
    description?: string | null;
    filePath: string;
    fileType: string;
    size: number;
    documentType: DocumentType;
  }) {
    return prisma.patientDocument.create({
      data: {
        patientId: data.patientId,
        fileName: data.fileName,
        description: data.description,
        filePath: data.filePath,
        fileType: data.fileType,
        size: data.size,
        type: data.documentType,
        status: "PENDING",
      },
    });
  }

  // Delete a document
  static async deleteDocument(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId },
      },
    });

    // Remove from storage
    if (document.filePath) {
      const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([document.filePath]);

      if (error) {
        console.error(
          "Supabase storage deletion error (documents):",
          error.message
        );
      }
    }

    // Delete from database
    await prisma.patientDocument.delete({
      where: { id: documentId },
    });
  }

  // Get signed download URL
  static async getDocumentDownloadUrl(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId },
      },
    });

    if (!document.filePath) {
      throw new Error("Document file not found");
    }

    // Create a signed URL that expires in 1 hour
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(document.filePath, 3600); // 3600 seconds = 1 hour

    if (error || !data) {
      console.error("Error creating signed URL:", error);
      throw new Error("Could not generate download URL");
    }

    return {
      signedUrl: data.signedUrl,
      fileName: document.fileName,
      fileType: document.fileType,
    };
  }

  static async getAttachmentDownloadUrl(
    attachmentId: string,
    clinicId: string
  ) {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: {
        id: attachmentId,
        patient: { clinicId },
      },
    });

    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.filePath, 3600, {
        // 1 hour expiration
        download: attachment.fileName, // This prompts a download with the correct filename
      });

    if (error || !data) {
      console.error(
        "Error creating signed download URL for attachment:",
        error
      );
      throw new Error("Could not generate download URL");
    }

    return { signedUrl: data.signedUrl };
  }
}

```

# services\auth.service.ts

```ts
// src/services/auth.service.ts
import { prisma } from "../lib/prisma";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../schemas/auth.schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export class AuthService {
  static async login(data: LoginInput) {
    const { email, password } = data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        clinic: true,
      },
    });

    if (!user) {
      throw { code: "UNAUTHORIZED", message: "Email ou senha inválidos." };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw { code: "UNAUTHORIZED", message: "Email ou senha inválidos." };
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("Chave secreta JWT não configurada.");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        roleId: user.roleId,
        clinicId: user.clinicId,
      },
      secret,
      { expiresIn: "7d" }
    );

    const { passwordHash, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  static async register(data: RegisterInput) {
    const { email, taxId, password, fullName, clinicName } = data;

    // 1. Verificar se o email ou CNPJ já existem
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Lançar um erro específico para conflito
      throw { code: "CONFLICT", message: "Este email já está em uso." };
    }

    const existingClinic = await prisma.clinic.findUnique({ where: { taxId } });
    if (existingClinic) {
      throw { code: "CONFLICT", message: "Este CNPJ já está cadastrado." };
    }

    // 2. Criptografar a senha
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Criar a Clínica e o Usuário em uma única transação
    // Isso garante que se a criação do usuário falhar, a da clínica será desfeita.
    const result = await prisma.$transaction(async (tx) => {
      // Encontrar o ID da função 'Admin' ou 'Proprietário'
      // IMPORTANTE: Você precisa ter essa função cadastrada no seu banco!
      const adminRole = await tx.role.findFirst({
        where: { name: "admin" }, // ou o nome que você deu para o dono da clínica
      });

      if (!adminRole) {
        throw new Error(
          "Função de administrador não encontrada. Configure as funções no banco."
        );
      }

      // Criar a clínica
      const newClinic = await tx.clinic.create({
        data: {
          name: clinicName,
          taxId: taxId,
          // O status 'PENDING_PAYMENT' será o padrão definido no schema
        },
      });

      // Criar o usuário
      const newUser = await tx.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          clinicId: newClinic.id,
          roleId: adminRole.id,
        },
        include: {
          clinic: true,
        },
      });

      return newUser;
    });

    // 4. Gerar um token JWT para auto-login
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Chave secreta JWT não configurada.");

    const token = jwt.sign(
      { userId: result.id, roleId: result.roleId, clinicId: result.clinicId },
      secret,
      { expiresIn: "7d" }
    );

    // 5. Retornar os dados
    const { passwordHash: _, ...userWithoutPassword } = result;
    return { user: userWithoutPassword, token };
  }

  static async forgotPassword(data: ForgotPasswordInput) {
    const { email } = data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 3600000); // Expira em 1 hora

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      await resend.emails.send({
        from: "Acme <onboarding@resend.dev>",
        to: user.email,
        subject: "Redefinição de Senha - AURA",
        html: `<p>Olá ${user.fullName},</p><p>Você solicitou a redefinição de sua senha. Clique no link abaixo para criar uma nova senha:</p><a href="${resetLink}">Redefinir Senha</a><p>Se você não solicitou isso, por favor, ignore este email.</p>`,
      });
    }
    return {
      message:
        "Se um usuário com este email existir, um link de redefinição foi enviado.",
    };
  }

  static async resetPassword(data: ResetPasswordInput) {
    const { token, password } = data;

    // 1. Encontrar o token no banco
    const savedToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!savedToken) {
      throw { code: "NOT_FOUND", message: "Token inválido ou expirado." };
    }

    // 2. Verificar se o token expirou
    if (new Date() > savedToken.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { id: savedToken.id } });
      throw {
        code: "GONE",
        message: "Token expirado. Por favor, solicite um novo.",
      };
    }

    // 3. Criptografar a nova senha
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Atualizar a senha do usuário e deletar o token em uma transação
    await prisma.$transaction([
      prisma.user.update({
        where: { id: savedToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({
        where: { id: savedToken.id },
      }),
    ]);

    return { message: "Senha redefinida com sucesso!" };
  }
}

```

# services\catalog.service.ts

```ts
// src/services/catalog.service.ts
import { prisma } from "../lib/prisma";

type CatalogModel =
  | "specialty"
  | "appointmentType"
  | "trafficSource"
  | "procedure";

export class CatalogService {
  static async getById(model: CatalogModel, id: string) {
    // @ts-ignore
    return prisma[model].findUnique({ where: { id } });
  }
  // Método genérico para listar itens de qualquer catálogo
  static async list(model: CatalogModel) {
    // @ts-ignore - Usamos um truque para acessar o model do prisma dinamicamente
    return prisma[model].findMany({ orderBy: { name: "asc" } });
  }

  // Método genérico para criar itens
  static async create(model: CatalogModel, data: { name: string }) {
    // @ts-ignore
    return prisma[model].create({ data });
  }

  // Método genérico para atualizar
  static async update(model: CatalogModel, id: string, data: { name: string }) {
    // @ts-ignore
    return prisma[model].update({ where: { id }, data });
  }

  // Método genérico para deletar
  static async delete(model: CatalogModel, id: string) {
    // @ts-ignore
    return prisma[model].delete({ where: { id } });
  }

  // Métodos específicos para Procedimentos, que são mais complexos
  static async listProcedures() {
    return prisma.procedure.findMany({
      include: { specialty: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  static async createProcedure(data: any) {
    return prisma.procedure.create({ data });
  }

  static async updateProcedure(id: string, data: any) {
    return prisma.procedure.update({ where: { id }, data });
  }
}

```

# services\commissionPlan.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateCommissionPlanInput,
  UpdateCommissionPlanInput,
} from "../schemas/commission.schema";

export class CommissionPlanService {
  /**
   * Cria um novo plano de comissão e suas faixas (tiers) de forma transacional.
   */
  static async create(data: CreateCommissionPlanInput, clinicId: string) {
    const { tiers, ...planData } = data;

    return prisma.commissionPlan.create({
      data: {
        ...planData,
        clinicId,
        tiers: {
          create: tiers, // Prisma cria as faixas relacionadas
        },
      },
      include: { tiers: { orderBy: { minThreshold: "asc" } } },
    });
  }

  /**
   * Lista os planos de comissão da clínica.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.CommissionPlanWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [plans, totalCount] = await prisma.$transaction([
      prisma.commissionPlan.findMany({
        where,
        include: { tiers: { orderBy: { minThreshold: "asc" } } },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.commissionPlan.count({ where }),
    ]);

    return { data: plans, totalCount };
  }

  /**
   * Busca um plano de comissão específico pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.commissionPlan.findFirst({
      where: { id, clinicId },
      include: { tiers: { orderBy: { minThreshold: "asc" } } },
    });
  }

  /**
   * Atualiza um plano de comissão. A estratégia é substituir todas as faixas antigas pelas novas.
   */
  static async update(
    id: string,
    data: UpdateCommissionPlanInput,
    clinicId: string
  ) {
    const { tiers, ...planData } = data;

    return prisma.$transaction(async (tx) => {
      // Garante que o plano pertence à clínica
      await tx.commissionPlan.findFirstOrThrow({ where: { id, clinicId } });

      // Atualiza os dados do plano (nome, descrição, etc.)
      const updatedPlan = await tx.commissionPlan.update({
        where: { id },
        data: { ...planData },
      });

      // Se novas faixas foram enviadas, substitui as antigas
      if (tiers) {
        // 1. Deleta todas as faixas antigas
        await tx.commissionTier.deleteMany({ where: { commissionPlanId: id } });
        // 2. Cria as novas faixas
        await tx.commissionTier.createMany({
          data: tiers.map((tier) => ({ ...tier, commissionPlanId: id })),
        });
      }

      // Retorna o plano completo e atualizado
      return tx.commissionPlan.findUnique({
        where: { id },
        include: { tiers: { orderBy: { minThreshold: "asc" } } },
      });
    });
  }

  /**
   * Deleta um plano, verificando se ele não está em uso por algum profissional.
   */
  static async delete(id: string, clinicId: string) {
    await prisma.commissionPlan.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Impede a exclusão se o plano estiver vinculado a um usuário.
    const userCount = await prisma.user.count({
      where: { commissionPlanId: id },
    });

    if (userCount > 0) {
      throw new Error("PLAN_IN_USE");
    }

    // A exclusão dos tiers acontece em cascata (onDelete: Cascade no Prisma schema)
    return prisma.commissionPlan.delete({ where: { id } });
  }
}

```

# services\commissionRecord.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  Prisma,
  CommissionStatus,
  CommissionTriggerEvent,
} from "@prisma/client";
import { MarkCommissionAsPaidInput } from "../schemas/commissionRecord.schema";

// Interface interna para criação
interface CreateCommissionRecordData {
  clinicId: string;
  professionalId: string;
  treatmentPlanId: string;
  paymentInstallmentId?: string;
  calculatedAmount: number | Prisma.Decimal;
}
// Interface para os dados necessários para criar um registro de comissão
// Usado internamente por outros serviços
interface CreateCommissionRecordData {
  clinicId: string;
  professionalId: string;
  treatmentPlanId: string;
  paymentInstallmentId?: string; // Opcional, se a comissão for por parcela
  calculatedAmount: number | Prisma.Decimal;
}

export class CommissionRecordService {
  /**
   * (Método Interno) Cria um registro de comissão.
   * Chamado por outros serviços (ex: PaymentInstallmentService).
   * Usamos 'tx' para garantir que seja chamado dentro de uma transação.
   */
  static async create(
    tx: Prisma.TransactionClient,
    data: CreateCommissionRecordData
  ) {
    // Adiciona validação básica para garantir que o valor é numérico e não negativo
    if (
      typeof data.calculatedAmount !== "number" &&
      !(data.calculatedAmount instanceof Prisma.Decimal)
    ) {
      throw new TypeError("calculatedAmount deve ser um número ou Decimal.");
    }
    if (Number(data.calculatedAmount) < 0) {
      console.warn(
        `Tentativa de criar comissão com valor negativo (${data.calculatedAmount}) para o plano ${data.treatmentPlanId}. Comissão não será criada.`
      );
      return null; // Ou lançar um erro, dependendo da regra de negócio
    }

    return tx.commissionRecord.create({
      data: {
        ...data,
        calculatedAmount: new Prisma.Decimal(data.calculatedAmount.toString()), // Garante que é Decimal
        status: CommissionStatus.PENDING,
        calculationDate: new Date(),
      },
    });
  }

  /**
   * Calcula e registra a comissão baseada em um TreatmentPlan.
   * Regra Exemplo: Comissão é X% sobre o valor TOTAL do plano, liberada quando a PRIMEIRA parcela é paga.
   */
  static async calculateAndRecordCommissionForPlan(
    tx: Prisma.TransactionClient,
    treatmentPlanId: string,
    paymentInstallmentId?: string // Opcional: ID da parcela que foi paga (relevante para alguns gatilhos)
  ) {
    // 1. Busca dados essenciais (Plano, Vendedor, Plano de Comissão, Tiers)
    const plan = await tx.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      include: {
        seller: {
          include: {
            CommissionPlan: {
              include: { tiers: { orderBy: { minThreshold: "asc" } } },
            },
          },
        },
      },
    });

    // Validação robusta
    if (
      !plan?.seller?.CommissionPlan?.tiers ||
      plan.seller.CommissionPlan.tiers.length === 0
    ) {
      console.warn(
        `Plano ${treatmentPlanId} ou vendedor/plano de comissão não encontrado/configurado para cálculo.`
      );
      return null;
    }

    const seller = plan.seller;
    const commissionPlan = seller.CommissionPlan; // Sabemos que existe
    const tiers = commissionPlan!.tiers;
    const triggerEvent = commissionPlan!.triggerEvent; // Pega o gatilho configurado

    // 2. Verifica Idempotência (Não recalcular se já existe PENDING/PAID para o mesmo gatilho/item)
    const existingCommissionWhere: Prisma.CommissionRecordWhereInput = {
      treatmentPlanId: treatmentPlanId,
      status: { in: [CommissionStatus.PENDING, CommissionStatus.PAID] },
    };
    // Se for por parcela, a chave de idempotência inclui a parcela
    if (
      triggerEvent === CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID &&
      paymentInstallmentId
    ) {
      existingCommissionWhere.paymentInstallmentId = paymentInstallmentId;
    }
    const existingCommission = await tx.commissionRecord.findFirst({
      where: existingCommissionWhere,
    });

    if (existingCommission) {
      console.log(
        `Comissão já registrada/paga para ${
          paymentInstallmentId
            ? `parcela ${paymentInstallmentId}`
            : `plano ${treatmentPlanId}`
        } conforme gatilho ${triggerEvent}.`
      );
      return null; // Evita duplicação
    }

    // 3. Define a Base de Cálculo da Comissão
    let commissionBaseAmountDecimal = plan.total; // Padrão: Total do plano
    if (
      triggerEvent === CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID &&
      paymentInstallmentId
    ) {
      const installment = await tx.paymentInstallment.findUnique({
        where: { id: paymentInstallmentId },
      });
      if (installment) {
        commissionBaseAmountDecimal = installment.amountDue; // Base é o valor da parcela
        console.log(
          `Calculando comissão ON_EACH_INSTALLMENT_PAID sobre ${commissionBaseAmountDecimal} da parcela ${paymentInstallmentId}`
        );
      } else {
        console.warn(
          `Parcela ${paymentInstallmentId} não encontrada para cálculo de comissão por parcela.`
        );
        return null;
      }
    }
    const commissionBaseAmount = Number(commissionBaseAmountDecimal); // Converte para número para comparações

    // 4. Encontra a Faixa de Comissão Aplicável
    let applicableTier = null;
    for (const tier of tiers) {
      const min = Number(tier.minThreshold);
      const max = tier.maxThreshold ? Number(tier.maxThreshold) : null; // Converte max para número ou null

      // Se base for menor que o mínimo da primeira faixa, não aplica nenhuma
      if (commissionBaseAmount < min && tiers.indexOf(tier) === 0) {
        console.log(
          `Valor base ${commissionBaseAmount} abaixo da primeira faixa (${min}) para ${seller.fullName}.`
        );
        applicableTier = null;
        break;
      }

      // Verifica se está dentro da faixa
      if (
        commissionBaseAmount >= min &&
        (max === null || commissionBaseAmount <= max)
      ) {
        applicableTier = tier;
        break; // Encontrou
      }

      // Se chegou na última faixa, ela não tem limite e a base é maior ou igual ao mínimo dela, aplica
      if (
        tiers.indexOf(tier) === tiers.length - 1 &&
        max === null &&
        commissionBaseAmount >= min
      ) {
        applicableTier = tier;
        break;
      }
    }

    if (!applicableTier) {
      console.warn(
        `Nenhuma faixa de comissão encontrada para ${
          seller.fullName
        } no valor base ${commissionBaseAmount} (Plano: ${
          commissionPlan!.name
        }).`
      );
      return null;
    }

    // 5. Calcula o Valor da Comissão
    const commissionAmount =
      (commissionBaseAmount * Number(applicableTier.percentage)) / 100;

    // 6. Cria o Registro de Comissão
    console.log(
      `Criando registro de comissão: ${commissionAmount} para ${
        seller.fullName
      } (Plano: ${treatmentPlanId}, Parcela: ${paymentInstallmentId || "N/A"})`
    );
    return CommissionRecordService.create(tx, {
      clinicId: plan.clinicId,
      professionalId: seller.id,
      treatmentPlanId: plan.id,
      paymentInstallmentId: paymentInstallmentId, // Passa ID da parcela se aplicável
      calculatedAmount: commissionAmount,
    });
  }

  /**
   * Lista os registros de comissão com filtros e paginação.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      professionalId?: string;
      status?: CommissionStatus;
      dateStart?: string;
      dateEnd?: string; // Filtrar por calculationDate
    }
  ) {
    const where: Prisma.CommissionRecordWhereInput = { clinicId };

    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.status) where.status = filters.status;
    if (filters.dateStart || filters.dateEnd) {
      where.calculationDate = {};
      if (filters.dateStart)
        where.calculationDate.gte = new Date(filters.dateStart);
      if (filters.dateEnd)
        where.calculationDate.lte = new Date(filters.dateEnd);
    }

    const skip = (page - 1) * pageSize;
    const [records, totalCount] = await prisma.$transaction([
      prisma.commissionRecord.findMany({
        where,
        include: {
          professional: { select: { fullName: true } },
          treatmentPlan: {
            select: { id: true, patient: { select: { name: true } } },
          },
        },
        skip,
        take: pageSize,
        orderBy: { calculationDate: "desc" },
      }),
      prisma.commissionRecord.count({ where }),
    ]);

    return { data: records, totalCount };
  }

  /**
   * Marca uma comissão como paga.
   */
  static async markAsPaid(
    id: string,
    clinicId: string,
    data: MarkCommissionAsPaidInput
  ) {
    await prisma.commissionRecord.findFirstOrThrow({
      where: {
        id,
        clinicId,
        status: CommissionStatus.PENDING, // Só pode pagar o que está pendente
      },
    });

    return prisma.commissionRecord.update({
      where: { id },
      data: {
        status: CommissionStatus.PAID,
        paymentDate: new Date(data.paymentDate),
      },
    });
  }
}

```

# services\dashboard.service.ts

```ts
import { prisma } from "../lib/prisma";

export class DashboardService {
  /**
   * Busca os profissionais de uma clínica específica.
   */
  static async getProfessionals(clinicId: string) {
    return prisma.user.findMany({
      where: {
        clinicId: clinicId,
        isProfessional: true,
      },
      select: {
        id: true,
        fullName: true,
        color: true,
      },
    });
  }

  /**
   * Busca os agendamentos de uma clínica dentro de um período.
   */
  static async getAppointments(
    clinicId: string,
    startDate: Date,
    endDate: Date,
    professionalIds?: string[]
  ) {
    // Constrói a cláusula 'where' dinamicamente
    const whereClause: any = {
      professional: {
        clinicId: clinicId,
      },
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Adiciona o filtro de profissionais se ele for fornecido
    if (professionalIds && professionalIds.length > 0) {
      whereClause.professionalId = {
        in: professionalIds,
      };
    }

    return prisma.appointment.findMany({
      where: whereClause,
      include: {
        // 1. Paciente: Adicionar CPF e telefones
        patient: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            cpf: true,
            phones: true,
          },
        },

        // 2. Profissional: Já está OK para o modal
        professional: {
          select: {
            fullName: true,
            color: true,
          },
        },

        // 3. Tipo de Agendamento: Faltando completamente
        appointmentType: {
          select: {
            name: true,
          },
        },

        // 4. Plano de Tratamento: Faltando completamente
        treatmentPlan: {
          include: {
            seller: {
              select: {
                fullName: true,
              },
            },
            procedures: {
              select: {
                contractedSessions: true,
                completedSessions: true,
                procedure: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });
  }
}

```

# services\expense.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma, PaymentStatus, TransactionType } from "@prisma/client";
import {
  CreateExpenseInput,
  UpdateExpenseInput,
  MarkExpenseAsPaidInput,
} from "../schemas/expense.schema";

export class ExpenseService {
  static async create(data: CreateExpenseInput, clinicId: string) {
    // Opcional: Validar se supplierId e categoryId pertencem à clínica
    if (data.supplierId) {
      await prisma.supplier.findFirstOrThrow({
        where: { id: data.supplierId, clinicId },
      });
    }
    if (data.categoryId) {
      await prisma.expenseCategory.findFirstOrThrow({
        where: { id: data.categoryId, clinicId },
      });
    }

    return prisma.expense.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: PaymentStatus[];
      dueDateStart?: string;
      dueDateEnd?: string;
      categoryId?: string;
      supplierId?: string;
    }
  ) {
    const where: Prisma.ExpenseWhereInput = { clinicId };
    const now = new Date();

    // Lógica de Status similar a PaymentInstallment
    if (filters.status && filters.status.length > 0) {
      const directStatuses = filters.status.filter(
        (s) => s !== PaymentStatus.OVERDUE
      );
      const conditions: Prisma.ExpenseWhereInput[] = [];
      if (directStatuses.length > 0)
        conditions.push({ status: { in: directStatuses } });
      if (filters.status.includes(PaymentStatus.OVERDUE)) {
        conditions.push({
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        });
      }
      where.OR = conditions;
    }

    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = {};
      if (filters.dueDateStart)
        where.dueDate.gte = new Date(filters.dueDateStart);
      if (filters.dueDateEnd) where.dueDate.lte = new Date(filters.dueDateEnd);
    }
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.supplierId) where.supplierId = filters.supplierId;

    const skip = (page - 1) * pageSize;
    const [expenses, totalCount] = await prisma.$transaction([
      prisma.expense.findMany({
        where,
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { dueDate: "asc" },
      }),
      prisma.expense.count({ where }),
    ]);

    // Adiciona status OVERDUE dinamicamente
    const expensesWithStatus = expenses.map((exp) => ({
      ...exp,
      status:
        exp.status === PaymentStatus.PENDING && exp.dueDate < now
          ? PaymentStatus.OVERDUE
          : exp.status,
    }));

    return { data: expensesWithStatus, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.expense.findFirst({
      where: { id, clinicId },
      include: { category: true, supplier: true },
    });
  }

  static async update(id: string, clinicId: string, data: UpdateExpenseInput) {
    await prisma.expense.findFirstOrThrow({ where: { id, clinicId } });
    // Opcional: Validar supplierId e categoryId se forem alterados
    if (data.supplierId)
      await prisma.supplier.findFirstOrThrow({
        where: { id: data.supplierId, clinicId },
      });
    if (data.categoryId)
      await prisma.expenseCategory.findFirstOrThrow({
        where: { id: data.categoryId, clinicId },
      });

    return prisma.expense.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.expense.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.expense.delete({ where: { id } });
  }

  static async markAsPaid(
    id: string,
    clinicId: string,
    data: MarkExpenseAsPaidInput
  ) {
    return prisma.$transaction(async (tx) => {
      // Envolve em transação
      // 1. Valida e busca a despesa
      const expense = await tx.expense.findFirstOrThrow({
        where: {
          id,
          clinicId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
        },
      });

      // --- Validação da Conta Bancária ---
      await tx.bankAccount.findFirstOrThrow({
        where: { id: data.bankAccountId, clinicId: clinicId },
      });
      // ---------------------------------

      // 2. Atualiza o status da despesa
      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: PaymentStatus.PAID,
          paymentDate: new Date(data.paymentDate),
        },
      });

      // 3. Cria a transação financeira de SAÍDA
      await tx.financialTransaction.create({
        data: {
          clinicId: clinicId,
          description: updatedExpense.description, // Descrição da despesa
          amount: updatedExpense.amount, // Valor total da despesa
          type: TransactionType.EXPENSE, // Tipo correto importado
          date: new Date(data.paymentDate), // Data do pagamento
          bankAccountId: data.bankAccountId, // Conta de onde saiu
          expenseId: updatedExpense.id, // Linka com a despesa
        },
      });

      // 4. Atualiza o saldo da BankAccount (DECREMENTAR)
      await tx.bankAccount.update({
        where: { id: data.bankAccountId },
        data: { balance: { decrement: updatedExpense.amount } }, // Decrementa o saldo
      });
      console.log(
        `Saldo da conta ${data.bankAccountId} decrementado em ${updatedExpense.amount}.`
      );

      return updatedExpense; // Retorna a despesa atualizada
    });
  }
}

```

# services\expenseCategory.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from "../schemas/expenseCategory.schema";

export class ExpenseCategoryService {
  static async create(data: CreateExpenseCategoryInput, clinicId: string) {
    return prisma.expenseCategory.create({ data: { ...data, clinicId } });
  }

  static async list(clinicId: string, name?: string) {
    const where: Prisma.ExpenseCategoryWhereInput = { clinicId };
    if (name) where.name = { contains: name, mode: "insensitive" };
    return prisma.expenseCategory.findMany({ where, orderBy: { name: "asc" } });
  }

  static async getById(id: string, clinicId: string) {
    return prisma.expenseCategory.findFirst({ where: { id, clinicId } });
  }

  static async update(
    id: string,
    clinicId: string,
    data: UpdateExpenseCategoryInput
  ) {
    await prisma.expenseCategory.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.expenseCategory.update({ where: { id }, data });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.expenseCategory.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Não permitir exclusão se usada em despesas
    const expenseCount = await prisma.expense.count({
      where: { categoryId: id },
    });
    if (expenseCount > 0) {
      throw new Error("CATEGORY_IN_USE");
    }
    return prisma.expenseCategory.delete({ where: { id } });
  }
}

```

# services\medicalReport.service.ts

```ts
import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createReportSchema,
  updateReportSchema,
} from "../schemas/medicalReport.schema";
import PdfService from "./pdf.service";

export class MedicalReportService {
  static async create(data: z.infer<typeof createReportSchema>) {
    return prisma.medicalReport.create({
      data,
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findByPatientId(patientId: string) {
    return prisma.medicalReport.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findById(reportId: string) {
    return prisma.medicalReport.findUniqueOrThrow({
      where: { id: reportId },
    });
  }

  static async update(
    reportId: string,
    data: z.infer<typeof updateReportSchema>
  ) {
    return prisma.medicalReport.update({
      where: { id: reportId },
      data,
    });
  }

  static async delete(reportId: string) {
    return prisma.medicalReport.delete({
      where: { id: reportId },
    });
  }

  static async generatePdf(
    reportId: string,
    clinicId: string
  ): Promise<Buffer> {
    const report = await this.findById(reportId);
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      include: { address: true },
    });

    const pdfBuffer = await this._generatePDFFromHTML(
      report.content,
      clinic,
      "Laudo Médico"
    );

    return pdfBuffer;
  }

  private static async _generatePDFFromHTML(
    content: string,
    clinic: any,
    documentTitle: string
  ): Promise<Buffer> {
    const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
      <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
      ${
        clinic.address
          ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>`
          : ""
      }
      <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
    </div>
  `;

    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 2cm 1.5cm;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

    const pdfBuffer = await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
      margin: { top: "120px", bottom: "60px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }
}

```

# services\patient.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  CreatePatientInput,
  UpdatePatientInput,
} from "../schemas/patient.schema";
import { Prisma } from "@prisma/client";

export class PatientService {
  static async create(clinicId: string, data: CreatePatientInput) {
    const { address, phones, ...patientData } = data;

    return prisma.$transaction(async (tx) => {
      const newAddress = await tx.address.create({
        data: address,
      });

      const newPatient = await tx.patient.create({
        data: {
          ...patientData,
          birthDate: new Date(patientData.birthDate),
          guardianBirthDate: patientData.guardianBirthDate
            ? new Date(patientData.guardianBirthDate)
            : null,
          clinicId,
          addressId: newAddress.id,
        },
      });

      await tx.phone.createMany({
        data: phones.map((phone) => ({
          ...phone,
          patientId: newPatient.id,
        })),
      });

      return newPatient;
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    document?: string
  ) {
    const where: Prisma.PatientWhereInput = { clinicId };

    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (document) {
      where.OR = [
        { cpf: { contains: document } },
        { identityCard: { contains: document } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [patients, totalCount] = await prisma.$transaction([
      prisma.patient.findMany({
        where,
        include: {
          clinic: { select: { name: true } },
          phones: { take: 1 },
        },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.patient.count({ where }),
    ]);

    return { patients, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.patient.findFirst({
      where: { id, clinicId },
      include: {
        address: true,
        phones: true,
        trafficSource: true,
        treatmentPlans: {
          orderBy: { createdAt: "desc" },
          include: {
            seller: { select: { fullName: true } },
            procedures: {
              include: {
                procedure: { select: { name: true } },
              },
            },
          },
        },
        appointments: {
          orderBy: { date: "desc" },
          include: {
            appointmentType: { select: { name: true } },
            professional: { select: { fullName: true } },
          },
        },
        assessments: {
          orderBy: { createdAt: "desc" },
          include: {
            template: { select: { name: true } },
            appointment: {
              select: {
                id: true,
                date: true,
                appointmentType: { select: { name: true } },
                professional: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
  }

  static async update(id: string, clinicId: string, data: UpdatePatientInput) {
    const { address, phones, ...patientData } = data;

    const existingPatient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
      select: { addressId: true },
    });

    return prisma.$transaction(async (tx) => {
      if (address && existingPatient.addressId) {
        await tx.address.update({
          where: { id: existingPatient.addressId },
          data: address,
        });
      }

      if (phones) {
        await tx.phone.deleteMany({ where: { patientId: id } });
        await tx.phone.createMany({
          data: phones.map((phone) => ({ ...phone, patientId: id })),
        });
      }

      const updatedPatient = await tx.patient.update({
        where: { id },
        data: {
          ...patientData,
          birthDate: patientData.birthDate
            ? new Date(patientData.birthDate)
            : undefined,
          guardianBirthDate: patientData.guardianBirthDate
            ? new Date(patientData.guardianBirthDate)
            : undefined,
        },
      });
      return updatedPatient;
    });
  }

  static async delete(id: string, clinicId: string) {
    const patient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
      select: { addressId: true },
    });

    return prisma.$transaction(async (tx) => {
      await tx.patient.delete({ where: { id } });

      if (patient.addressId) {
        await tx.address.delete({ where: { id: patient.addressId } });
      }
    });
  }
}

```

# services\paymentInstallment.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  Prisma,
  PaymentStatus,
  CommissionTriggerEvent,
  TransactionType,
} from "@prisma/client";
import { RegisterPaymentInput } from "../schemas/paymentInstallment.schema";
import { CommissionRecordService } from "./commissionRecord.service";

export class PaymentInstallmentService {
  /**
   * Registra o pagamento de uma parcela, lida com pagamentos parciais
   * e dispara o cálculo de comissão de acordo com a regra do plano.
   */
  static async registerPayment(
    id: string,
    clinicId: string,
    data: RegisterPaymentInput
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Busca Parcela e Plano
      const installment = await tx.paymentInstallment.findFirstOrThrow({
        where: { id, clinicId },
        include: {
          treatmentPlan: {
            include: {
              seller: { include: { CommissionPlan: true } },
              _count: { select: { paymentInstallments: true } },
            },
          },
        },
      });

      // Validações Iniciais
      if (installment.status === PaymentStatus.CANCELED) {
        throw new Error(
          "Parcela está cancelada e não pode receber pagamentos."
        );
      }
      if (installment.status === PaymentStatus.PAID) {
        throw new Error("Parcela já consta como totalmente paga."); // Mensagem mais clara
      }

      // 2. Lógica de Pagamento Parcial e Status - Refatorada
      const currentPaidAmount = Number(installment.paidAmount || 0);
      const newlyPaidAmount = Number(data.paidAmount);
      const totalPaid = currentPaidAmount + newlyPaidAmount;
      const amountDue = Number(installment.amountDue);
      const isOverdue = installment.dueDate < new Date(); // Verifica se já estava vencida

      let newStatus: PaymentStatus;

      if (totalPaid >= amountDue) {
        newStatus = PaymentStatus.PAID; // Quitada!
      } else if (totalPaid > 0) {
        // Se pagou algo mas não quitou, mantém PENDING ou OVERDUE
        newStatus = isOverdue ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
      } else {
        // Se o total pago for zero ou menos (ex: estorno?), volta ao status original baseado na data
        newStatus = isOverdue ? PaymentStatus.OVERDUE : PaymentStatus.PENDING;
      }

      // Variáveis para lógica de comissão
      const isFirstPaymentForThisInstallment =
        currentPaidAmount === 0 && newlyPaidAmount > 0;
      // Verifica se a parcela foi quitada NESTE pagamento (transição de !PAID para PAID)
      const isNowFullyPaid =
        newStatus === PaymentStatus.PAID &&
        (installment.status as PaymentStatus) !== PaymentStatus.PAID;

      // 3. Atualiza a Parcela
      const updatedInstallment = await tx.paymentInstallment.update({
        where: { id },
        data: {
          status: newStatus,
          paidAmount: new Prisma.Decimal(totalPaid.toFixed(2)), // Salva o total pago acumulado
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      });

      if (newlyPaidAmount > 0) {
        await tx.financialTransaction.create({
          data: {
            clinicId: clinicId,
            // Usar optional chaining para nome do paciente
            description: `Recebimento Parcela ${
              installment.installmentNumber
            } - ${
              installment.treatmentPlan?.patient?.name ??
              "Paciente Desconhecido"
            }`,
            amount: new Prisma.Decimal(newlyPaidAmount.toFixed(2)), // Valor que acabou de ser pago
            type: TransactionType.REVENUE, // Tipo correto importado
            date: new Date(data.paymentDate),
            bankAccountId: data.bankAccountId, // Recebido do frontend
            paymentInstallmentId: updatedInstallment.id,
          },
        });

        // Atualizar o saldo da BankAccount (INCREMENTAR)
        await tx.bankAccount.update({
          where: { id: data.bankAccountId },
          data: { balance: { increment: newlyPaidAmount } },
        });
        console.log(
          `Saldo da conta ${data.bankAccountId} incrementado em ${newlyPaidAmount}.`
        );
      }

      // --- LÓGICA REFINADA PARA DISPARAR COMISSÃO ---
      const commissionPlan = installment.treatmentPlan?.seller?.CommissionPlan;
      const triggerEvent = commissionPlan?.triggerEvent;

      let shouldCalculateCommission = false;
      let installmentIdForCommission: string | undefined =
        updatedInstallment.id;

      switch (triggerEvent) {
        case CommissionTriggerEvent.ON_SALE:
          console.log("Comissão ON_SALE, não dispara no pagamento.");
          break;

        case CommissionTriggerEvent.ON_FIRST_INSTALLMENT_PAID: {
          // <-- Adiciona Chaves {}
          const anyPreviousPayment = await tx.paymentInstallment.findFirst({
            where: {
              treatmentPlanId: installment.treatmentPlanId,
              paidAmount: { gt: 0 },
              id: { not: updatedInstallment.id },
            },
          });
          if (isFirstPaymentForThisInstallment && !anyPreviousPayment) {
            console.log(
              `Disparando comissão ON_FIRST_INSTALLMENT_PAID para plano ${installment.treatmentPlanId}`
            );
            shouldCalculateCommission = true;
            installmentIdForCommission = undefined;
          }
          break;
        } // <-- Fecha Chaves {}

        case CommissionTriggerEvent.ON_FULL_PLAN_PAID: {
          // <-- Adiciona Chaves {}
          if (isNowFullyPaid) {
            const totalInstallmentsCount =
              installment.treatmentPlan?._count?.paymentInstallments ?? 0;
            const paidInstallmentsCount = await tx.paymentInstallment.count({
              where: {
                treatmentPlanId: installment.treatmentPlanId,
                status: PaymentStatus.PAID,
              },
            });
            if (
              totalInstallmentsCount > 0 &&
              paidInstallmentsCount === totalInstallmentsCount
            ) {
              console.log(
                `Disparando comissão ON_FULL_PLAN_PAID para plano ${installment.treatmentPlanId}`
              );
              shouldCalculateCommission = true;
              installmentIdForCommission = undefined;
            } else {
              console.log(
                `Plano ${installment.treatmentPlanId} quitou parcela ${id}, mas ainda não está totalmente pago (${paidInstallmentsCount}/${totalInstallmentsCount}).`
              );
            }
          }
          break;
        } // <-- Fecha Chaves {}

        case CommissionTriggerEvent.ON_EACH_INSTALLMENT_PAID:
          if (isNowFullyPaid) {
            console.log(
              `Disparando comissão ON_EACH_INSTALLMENT_PAID para parcela ${updatedInstallment.id}`
            );
            shouldCalculateCommission = true;
            // Mantém installmentIdForCommission com o ID da parcela
          }
          break;

        default:
          console.log(
            "Nenhum gatilho de comissão configurado ou reconhecido para o vendedor."
          );
      }

      // Dispara o cálculo se necessário
      if (shouldCalculateCommission && installment.treatmentPlanId) {
        try {
          await CommissionRecordService.calculateAndRecordCommissionForPlan(
            tx,
            installment.treatmentPlanId,
            installmentIdForCommission
          );
          console.log(`Cálculo de comissão processado para ${triggerEvent}.`);
        } catch (commissionError: any) {
          console.error(
            `Erro ao calcular/registrar comissão ${triggerEvent}:`,
            commissionError.message
          );
          // throw commissionError; // Descomente se a falha na comissão deve reverter o pagamento
        }
      }
      // --- FIM DA LÓGICA REFINADA ---

      return updatedInstallment;
    });
  }

  /**
   * Lista as parcelas com filtros e paginação.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: PaymentStatus[];
      dueDateStart?: string;
      dueDateEnd?: string;
      patientName?: string;
      treatmentPlanId?: string;
    }
  ) {
    const where: Prisma.PaymentInstallmentWhereInput = { clinicId };
    const now = new Date();

    // Lógica de Status
    if (filters.status && filters.status.length > 0) {
      const directStatuses = filters.status.filter(
        (s) => s !== PaymentStatus.OVERDUE
      );
      const conditions: Prisma.PaymentInstallmentWhereInput[] = [];
      if (directStatuses.length > 0)
        conditions.push({ status: { in: directStatuses } });
      if (filters.status.includes(PaymentStatus.OVERDUE)) {
        conditions.push({
          status: PaymentStatus.PENDING,
          dueDate: { lt: now },
        });
      }
      // Se NENHUM status direto foi selecionado E OVERDUE foi, ajusta a query
      // para pegar apenas PENDING+Vencido, senão pega (Status Diretos OU (PENDING+Vencido))
      if (
        directStatuses.length === 0 &&
        filters.status.includes(PaymentStatus.OVERDUE)
      ) {
        where.status = PaymentStatus.PENDING;
        where.dueDate = { lt: now };
      } else if (conditions.length > 0) {
        where.OR = conditions;
      }
    }

    // Filtros de Data
    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = { ...(where.dueDate as Prisma.DateTimeFilter) }; // Mantém filtro de OVERDUE se existir
      if (filters.dueDateStart)
        where.dueDate.gte = new Date(filters.dueDateStart);
      if (filters.dueDateEnd) where.dueDate.lte = new Date(filters.dueDateEnd);
    }

    // Filtro por Nome do Paciente
    if (filters.patientName) {
      // Combina com o filtro de clinicId existente
      where.treatmentPlan = {
        ...(where.treatmentPlan as Prisma.TreatmentPlanListRelationFilter), // Mantém outros filtros se houver
        patient: {
          name: { contains: filters.patientName, mode: "insensitive" },
        },
      };
    } else if (filters.treatmentPlanId) {
      where.treatmentPlanId = filters.treatmentPlanId;
    }

    const skip = (page - 1) * pageSize;
    const [installments, totalCount] = await prisma.$transaction([
      prisma.paymentInstallment.findMany({
        where,
        include: {
          treatmentPlan: {
            select: {
              id: true,
              patient: { select: { id: true, name: true } },
              _count: { select: { paymentInstallments: true } },
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: { dueDate: "asc" },
      }),
      prisma.paymentInstallment.count({ where }),
    ]);

    // Adiciona o status 'OVERDUE' dinamicamente
    const installmentsWithStatus = installments.map((inst) => ({
      ...inst,
      status:
        inst.status === PaymentStatus.PENDING && inst.dueDate < now
          ? PaymentStatus.OVERDUE
          : inst.status,
    }));

    return { data: installmentsWithStatus, totalCount };
  }

  /**
   * Busca uma parcela específica pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.paymentInstallment.findFirst({
      where: { id, clinicId },
      include: {
        treatmentPlan: {
          select: {
            id: true,
            patient: { select: { id: true, name: true } },
            _count: { select: { paymentInstallments: true } },
          },
        },
      },
    });
  }
}

```

# services\pdf.service.ts

```ts
// src/services/pdf.service.ts
import puppeteer from "puppeteer-core";
import os from "os";
import fs from "fs";

type LaunchOptions = Parameters<typeof puppeteer.launch>[0];

export class PdfService {
  static readonly commonArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--single-process",
    "--disable-extensions",
    "--disable-gpu",
  ];

  private static findChromeExecutable(): string | null {
    if (process.env.CHROME_EXECUTABLE_PATH) {
      return process.env.CHROME_EXECUTABLE_PATH;
    }

    const platform = os.platform();
    const candidates: string[] =
      platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : platform === "win32"
        ? [
            // common windows locations
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : [
            // linux common locations
            "/usr/bin/google-chrome-stable",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
          ];

    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (e) {
        /* ignore */
      }
    }
    return null;
  }

  private static async getLaunchOptions(): Promise<LaunchOptions> {
    const isProduction = process.env.NODE_ENV === "production";
    const executablePath = this.findChromeExecutable();

    if (!executablePath) {
      throw new Error(
        "Chrome/Chromium executable not found. Install Chromium on the VPS or set CHROME_EXECUTABLE_PATH. " +
          "If you prefer Puppeteer bundled Chromium, install 'puppeteer' (npm i puppeteer)."
      );
    }

    const opts: LaunchOptions = {
      executablePath,
      headless: true,
      args: this.commonArgs,
    };

    if (isProduction) {
      opts.headless = true;
      opts.args = [...(opts.args ?? []), "--no-zygote"];
    }

    return opts;
  }

  static async generatePdfFromHtml(
    html: string,
    options?: {
      format?: "A4" | "Letter";
      margin?: { top?: string; bottom?: string; left?: string; right?: string };
      headerTemplate?: string;
      footerTemplate?: string;
      displayHeaderFooter?: boolean;
    }
  ): Promise<Buffer> {
    const launchOptions = await this.getLaunchOptions();
    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: options?.format ?? "A4",
        printBackground: true,
        displayHeaderFooter: options?.displayHeaderFooter ?? false,
        headerTemplate: options?.headerTemplate,
        footerTemplate: options?.footerTemplate,
        margin: options?.margin,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
export default PdfService;

```

# services\prescription.service.ts

```ts
import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
} from "../schemas/prescription.schema";
import PdfService from "./pdf.service";

export class PrescriptionService {
  static async create(data: z.infer<typeof createPrescriptionSchema>) {
    return prisma.prescription.create({
      data,
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findByPatientId(patientId: string) {
    return prisma.prescription.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findById(prescriptionId: string) {
    return prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
    });
  }

  static async update(
    prescriptionId: string,
    data: z.infer<typeof updatePrescriptionSchema>
  ) {
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data,
    });
  }

  static async delete(prescriptionId: string) {
    return prisma.prescription.delete({
      where: { id: prescriptionId },
    });
  }

  static async generatePdf(
    prescriptionId: string,
    clinicId: string
  ): Promise<Buffer> {
    const prescription = await this.findById(prescriptionId);
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      include: { address: true },
    });

    const pdfBuffer = await this._generatePDFFromHTML(
      prescription.content,
      clinic,
      "Receituário"
    );

    return pdfBuffer;
  }

  private static async _generatePDFFromHTML(
    content: string,
    clinic: any,
    documentTitle: string
  ): Promise<Buffer> {
    const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
      <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
      ${
        clinic.address
          ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>`
          : ""
      }
      <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
    </div>
  `;

    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 2cm 1.5cm;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

    const pdfBuffer = await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
      margin: { top: "120px", bottom: "60px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }
}

```

# services\product.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductInput,
  UpdateProductInput,
} from "../schemas/product.schema";

export class ProductService {
  /**
   * Cria um novo produto, validando se a categoria e marca pertencem à clínica.
   */
  static async create(data: CreateProductInput, clinicId: string) {
    const { categoryId, brandId } = data;

    return prisma.$transaction(async (tx) => {
      await tx.productCategory.findFirstOrThrow({
        where: { id: categoryId, clinicId },
      });
      await tx.productBrand.findFirstOrThrow({
        where: { id: brandId, clinicId },
      });

      const product = await tx.product.create({
        data: {
          ...data,
          clinicId,
        },
      });

      return product;
    });
  }

  /**
   * Lista os produtos da clínica com paginação e filtros.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    sku?: string
  ) {
    const where: Prisma.ProductWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (sku) {
      where.sku = { contains: sku, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [products, totalCount] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.product.count({ where }),
    ]);

    return { data: products, totalCount };
  }

  /**
   * Busca um produto específico pelo ID.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.product.findFirst({
      where: { id, clinicId },
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Atualiza um produto, validando as chaves estrangeiras se forem alteradas.
   */
  static async update(id: string, data: UpdateProductInput, clinicId: string) {
    const { categoryId, brandId } = data;

    return prisma.$transaction(async (tx) => {
      // Garante que o produto a ser atualizado pertence à clínica
      await tx.product.findFirstOrThrow({ where: { id, clinicId } });

      // Se a categoria for alterada, valida a nova categoria
      if (categoryId) {
        await tx.productCategory.findFirstOrThrow({
          where: { id: categoryId, clinicId },
        });
      }
      // Se a marca for alterada, valida a nova marca
      if (brandId) {
        await tx.productBrand.findFirstOrThrow({
          where: { id: brandId, clinicId },
        });
      }

      return tx.product.update({
        where: { id },
        data,
      });
    });
  }

  /**
   * Deleta um produto, verificando antes se ele possui movimentações de estoque.
   */
  static async delete(id: string, clinicId: string) {
    await prisma.product.findFirstOrThrow({ where: { id, clinicId } });

    // REGRA DE NEGÓCIO: Impede a exclusão se o produto tiver histórico de movimentação.
    const movementCount = await prisma.stockMovement.count({
      where: { productId: id },
    });

    if (movementCount > 0) {
      throw new Error("PRODUCT_IN_USE");
    }

    return prisma.product.delete({ where: { id } });
  }
}

```

# services\productBrand.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductBrandInput,
  UpdateProductBrandInput,
} from "../schemas/productBrand.schema";

export class ProductBrandService {
  static async create(data: CreateProductBrandInput, clinicId: string) {
    return prisma.productBrand.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.ProductBrandWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [brands, totalCount] = await prisma.$transaction([
      prisma.productBrand.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.productBrand.count({ where }),
    ]);

    return { data: brands, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.productBrand.findFirst({
      where: { id, clinicId },
    });
  }

  static async update(
    id: string,
    data: UpdateProductBrandInput,
    clinicId: string
  ) {
    await prisma.productBrand.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.productBrand.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.productBrand.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se a marca estiver em uso.
    const productCount = await prisma.product.count({
      where: { brandId: id },
    });

    if (productCount > 0) {
      throw new Error("BRAND_IN_USE");
    }

    return prisma.productBrand.delete({ where: { id } });
  }
}

```

# services\productCategory.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
} from "../schemas/productCategory.schema";

export class ProductCategoryService {
  /**
   * Cria uma nova categoria de produto associada a uma clínica.
   */
  static async create(data: CreateProductCategoryInput, clinicId: string) {
    return prisma.productCategory.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  /**
   * Lista todas as categorias de uma clínica com paginação e filtro por nome.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.ProductCategoryWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [categories, totalCount] = await prisma.$transaction([
      prisma.productCategory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return { data: categories, totalCount };
  }

  /**
   * Busca uma categoria específica pelo ID, garantindo que pertença à clínica.
   */
  static async getById(id: string, clinicId: string) {
    return prisma.productCategory.findFirst({
      where: { id, clinicId },
    });
  }

  /**
   * Atualiza uma categoria, garantindo que ela pertença à clínica.
   */
  static async update(
    id: string,
    data: UpdateProductCategoryInput,
    clinicId: string
  ) {
    // Garante que o registro a ser atualizado pertence à clínica do usuário logado
    await prisma.productCategory.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.productCategory.update({
      where: { id },
      data,
    });
  }

  /**
   * Deleta uma categoria, mas antes verifica se ela não está sendo usada por nenhum produto.
   */
  static async delete(id: string, clinicId: string) {
    // Garante que a categoria existe e pertence à clínica
    const category = await prisma.productCategory.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se a categoria estiver em uso.
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      // Lança um erro específico que o controller pode capturar
      throw new Error("CATEGORY_IN_USE");
    }

    return prisma.productCategory.delete({ where: { id } });
  }
}

```

# services\professionalCouncil.service.ts

```ts
import { prisma } from "../lib/prisma";
import {
  CreateProfessionalCouncilInput,
  UpdateProfessionalCouncilInput,
} from "../schemas/professionalCouncil.schema";
import { Prisma } from "@prisma/client";

export class ProfessionalCouncilService {
  static async create(data: CreateProfessionalCouncilInput) {
    return prisma.professionalCouncil.create({ data });
  }

  static async list(page: number, pageSize: number, name?: string) {
    const where: Prisma.ProfessionalCouncilWhereInput = {};
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [data, totalCount] = await prisma.$transaction([
      prisma.professionalCouncil.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.professionalCouncil.count({ where }),
    ]);

    return { data, totalCount };
  }

  static async getById(id: string) {
    return prisma.professionalCouncil.findUnique({ where: { id } });
  }

  static async update(id: string, data: UpdateProfessionalCouncilInput) {
    await prisma.professionalCouncil.findUniqueOrThrow({ where: { id } });
    return prisma.professionalCouncil.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    await prisma.professionalCouncil.findUniqueOrThrow({ where: { id } });
    return prisma.professionalCouncil.delete({ where: { id } });
  }
}

```

# services\specialty.service.ts

```ts
// src/services/specialty.service.ts
import { prisma } from "../lib/prisma";

export class SpecialtyService {
  static async list() {
    return prisma.specialty.findMany({
      include: {
        _count: {
          select: { professionals: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getById(id: string) {
    return prisma.specialty.findUnique({
      where: { id },
      include: {
        professionals: {
          select: { id: true },
        },
      },
    });
  }

  static async create(data: { name: string; professionalIds?: string[] }) {
    return prisma.specialty.create({
      data: {
        name: data.name,
        professionals: {
          connect: data.professionalIds?.map((id) => ({ id })) || [],
        },
      },
    });
  }

  static async update(
    id: string,
    data: { name: string; professionalIds?: string[] }
  ) {
    return prisma.specialty.update({
      where: { id },
      data: {
        name: data.name,
        professionals: {
          set: data.professionalIds?.map((id) => ({ id })) || [],
        },
      },
    });
  }

  static async delete(id: string) {
    return prisma.specialty.delete({ where: { id } });
  }
}

```

# services\specialtyTemplate.service.ts

```ts
import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createTemplateSchema,
  updateTemplateSchema,
} from "../schemas/specialtyTemplate.schema";
import { DocumentType } from "@prisma/client";

export class SpecialtyTemplateService {
  static async create(data: z.infer<typeof createTemplateSchema>) {
    return prisma.specialtyTemplate.create({
      data,
      include: {
        specialty: true,
      },
    });
  }

  static async findMany(specialtyId: string, type?: DocumentType) {
    return prisma.specialtyTemplate.findMany({
      where: { specialtyId, ...(type && { type }) },
      orderBy: { createdAt: "desc" },
    });
  }

  static async findById(templateId: string) {
    return prisma.specialtyTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: {
        specialty: true,
      },
    });
  }

  static async update(
    templateId: string,
    data: z.infer<typeof updateTemplateSchema>
  ) {
    return prisma.specialtyTemplate.update({
      where: { id: templateId },
      data,
    });
  }

  static async delete(templateId: string) {
    // Check if template is being used
    const usageCount = await prisma.patientDocument.count({
      where: { templateId },
    });

    if (usageCount > 0) {
      throw new Error(
        `Este template está sendo usado em ${usageCount} documento(s) e não pode ser excluído.`
      );
    }

    return prisma.specialtyTemplate.delete({
      where: { id: templateId },
    });
  }
}

```

# services\stockMovement.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateStockMovementInput } from "../schemas/stockMovement.schema";

export class StockMovementService {
  /**
   * Cria uma nova movimentação de estoque de forma transacional,
   * atualizando a quantidade do produto correspondente.
   */
  static async create(data: CreateStockMovementInput, clinicId: string) {
    const { productId, type, quantity, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      // 1. Busca o produto para garantir que ele existe e pertence à clínica.
      const product = await tx.product.findFirstOrThrow({
        where: { id: productId, clinicId },
      });

      // 2. Calcula a nova quantidade em estoque com base no tipo de movimentação.
      let newStock;
      if (type === "ENTRY") {
        newStock = product.currentStock + quantity;
      } else {
        // 'EXIT'
        if (product.currentStock < quantity) {
          // REGRA DE NEGÓCIO: Impede que o estoque fique negativo.
          throw new Error("Estoque insuficiente para a saída.");
        }
        newStock = product.currentStock - quantity;
      }

      // 3. Atualiza o estoque do produto.
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      // 4. Cria o registro da movimentação.
      const movement = await tx.stockMovement.create({
        data: {
          ...rest,
          productId,
          type,
          quantity,
          date: new Date(data.date),
        },
      });

      return movement;
    });
  }

  /**
   * Lista o histórico de movimentações da clínica com paginação e filtros.
   */
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    filters: { productId?: string; type?: "ENTRY" | "EXIT" }
  ) {
    const where: Prisma.StockMovementWhereInput = {
      // A segurança é garantida pela verificação do clinicId no produto relacionado.
      product: {
        clinicId: clinicId,
      },
    };

    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const skip = (page - 1) * pageSize;
    const [movements, totalCount] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          supplier: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { date: "desc" },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return { movements, totalCount };
  }

  /**
   * Deleta uma movimentação de forma transacional, revertendo o efeito no estoque.
   */
  static async delete(id: string, clinicId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Encontra a movimentação e garante que pertence à clínica (via produto)
      const movement = await tx.stockMovement.findFirstOrThrow({
        where: { id, product: { clinicId } },
        include: { product: true },
      });

      // 2. Calcula o estoque revertido
      let revertedStock;
      if (movement.type === "ENTRY") {
        revertedStock = movement.product.currentStock - movement.quantity;
        // REGRA DE NEGÓCIO: Impede a exclusão de uma entrada se isso for deixar o estoque negativo.
        if (revertedStock < 0) {
          throw new Error(
            "Não é possível excluir esta entrada, pois os itens já foram utilizados (estoque ficaria negativo)."
          );
        }
      } else {
        // 'EXIT'
        revertedStock = movement.product.currentStock + movement.quantity;
      }

      // 3. Atualiza o estoque do produto com o valor revertido
      await tx.product.update({
        where: { id: movement.productId },
        data: { currentStock: revertedStock },
      });

      // 4. Deleta a movimentação
      return tx.stockMovement.delete({ where: { id } });
    });
  }
}

```

# services\supplier.service.ts

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  CreateSupplierInput,
  UpdateSupplierInput,
} from "../schemas/supplier.schema";

export class SupplierService {
  static async create(data: CreateSupplierInput, clinicId: string) {
    return prisma.supplier.create({
      data: {
        ...data,
        clinicId,
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    const where: Prisma.SupplierWhereInput = { clinicId };
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }

    const skip = (page - 1) * pageSize;
    const [suppliers, totalCount] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.supplier.count({ where }),
    ]);

    return { data: suppliers, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.supplier.findFirst({
      where: { id, clinicId },
    });
  }

  static async update(id: string, data: UpdateSupplierInput, clinicId: string) {
    await prisma.supplier.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.supplier.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.supplier.findFirstOrThrow({
      where: { id, clinicId },
    });

    // REGRA DE NEGÓCIO: Não permitir a exclusão se o fornecedor tiver movimentações de estoque.
    const movementCount = await prisma.stockMovement.count({
      where: { supplierId: id },
    });

    if (movementCount > 0) {
      throw new Error("SUPPLIER_IN_USE");
    }

    return prisma.supplier.delete({ where: { id } });
  }
}

```

# services\treatmentPlan.service.ts

```ts
// src/services/treatmentPlan.service.ts
import { CommissionTriggerEvent, PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CreateTreatmentPlanInput } from "../schemas/treatmentPlan.schema";
import { CommissionRecordService } from "./commissionRecord.service";

export class TreatmentPlanService {
  /**
   * Cria um novo Plano de Tratamento e suas parcelas associadas.
   */
  static async create(clinicId: string, data: CreateTreatmentPlanInput) {
    // <-- Usa o tipo importado
    // Separa os dados do plano, procedimentos e termos de pagamento
    const { procedures, paymentTerms, ...planData } = data;

    if (!procedures || procedures.length === 0) {
      throw new Error("Pelo menos um procedimento é necessário.");
    }
    if (!paymentTerms || paymentTerms.numberOfInstallments < 1) {
      throw new Error("Termos de pagamento inválidos.");
    }

    return prisma.$transaction(async (tx) => {
      // 1. Cria o Plano de Tratamento
      const newPlan = await tx.treatmentPlan.create({
        data: {
          ...planData,
          clinicId,
          procedures: {
            create: procedures.map((proc) => ({
              procedureId: proc.procedureId,
              contractedSessions: proc.contractedSessions, // Já são números pelo Zod coerce
              unitPrice: proc.unitPrice, // Já é número pelo Zod coerce
              followUps: proc.followUps,
            })),
          },
        },
      });

      // --- LÓGICA COMPLETA DE CRIAÇÃO DE PARCELAS ---
      const totalAmount = newPlan.total;
      const numberOfInstallments = paymentTerms.numberOfInstallments;
      const installmentAmount = Number.parseFloat(
        (Number(totalAmount) / numberOfInstallments).toFixed(2)
      );

      // Calcula o valor da última parcela para ajustar arredondamentos
      const lastInstallmentAmount =
        Number(totalAmount) - installmentAmount * (numberOfInstallments - 1);

      const installmentsData = [];
      let currentDueDate = paymentTerms.firstDueDate
        ? new Date(paymentTerms.firstDueDate)
        : new Date();
      if (!paymentTerms.firstDueDate) {
        currentDueDate.setDate(currentDueDate.getDate() + 30); // Padrão D+30 se não informado
      }

      for (let i = 1; i <= numberOfInstallments; i++) {
        installmentsData.push({
          treatmentPlanId: newPlan.id,
          clinicId: clinicId,
          installmentNumber: i,
          dueDate: new Date(currentDueDate), // Cria uma nova instância da data
          amountDue:
            i === numberOfInstallments
              ? lastInstallmentAmount
              : installmentAmount, // Usa valor ajustado na última
          status: PaymentStatus.PENDING,
        });

        // Adiciona 1 mês para a próxima parcela (cuidado com virada de ano/mês)
        currentDueDate.setMonth(currentDueDate.getMonth() + 1);
      }

      // Cria todas as parcelas de uma vez
      await tx.paymentInstallment.createMany({
        data: installmentsData,
      });

      const sellerWithPlan = await tx.user.findUnique({
        where: { id: newPlan.sellerId },
        include: { CommissionPlan: true },
      });

      if (
        sellerWithPlan?.CommissionPlan?.triggerEvent ===
        CommissionTriggerEvent.ON_SALE
      ) {
        console.log(`Disparando comissão ON_SALE para plano ${newPlan.id}`);
        try {
          await CommissionRecordService.calculateAndRecordCommissionForPlan(
            tx,
            newPlan.id
          );
        } catch (commissionError: any) {
          console.error(
            `Erro ao calcular/registrar comissão ON_SALE para plano ${newPlan.id}:`,
            commissionError.message
          );
          // Decida se o erro na comissão deve falhar a criação do plano
          // throw commissionError;
        }
      }

      // Retorna o plano completo com as parcelas
      return tx.treatmentPlan.findUnique({
        where: { id: newPlan.id },
        include: {
          procedures: { include: { procedure: true } },
          patient: true,
          seller: true,
          paymentInstallments: { orderBy: { installmentNumber: "asc" } }, // Ordena as parcelas
        },
      });
    });
  }

  static async list(clinicId: string) {
    // A listagem pode incluir a contagem de parcelas totais e pagas, se útil
    return prisma.treatmentPlan.findMany({
      where: { clinicId },
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        _count: {
          select: {
            procedures: true,
            paymentInstallments: true, // Total de parcelas
          },
        },
        paymentInstallments: {
          // Para calcular quantas foram pagas
          where: { status: PaymentStatus.PAID },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getById(id: string, clinicId: string) {
    return prisma.treatmentPlan.findFirst({
      where: { id, clinicId },
      include: {
        patient: true,
        seller: true,
        procedures: {
          include: {
            procedure: true,
          },
        },
        // Inclui parcelas ordenadas ao buscar detalhes
        paymentInstallments: {
          orderBy: { installmentNumber: "asc" },
        },
      },
    });
  }
}

```

# services\user.service.ts

```ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

export class UserService {
  static async create(clinicId: string, data: any) {
    const { specialtyIds, password, ...userData } = data;
    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        clinicId,
        specialties: {
          connect: specialtyIds?.map((id: string) => ({ id })) || [],
        },
      },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    document?: string
  ) {
    const where: Prisma.UserWhereInput = { clinicId };

    if (name) where.fullName = { contains: name, mode: "insensitive" };
    if (document)
      where.OR = [
        { cpf: { contains: document } },
        { email: { contains: document } },
      ];

    const skip = (page - 1) * pageSize;
    const [users, totalCount] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: {
          specialties: true,
          role: true,
          // --- INCLUSÃO ADICIONADA ---
          CommissionPlan: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { fullName: "asc" },
      }),
      prisma.user.count({ where }),
    ]);
    // Renomeia o campo para facilitar no frontend (de CommissionPlan para commissionPlan)
    const formattedUsers = users.map(({ CommissionPlan, ...user }) => ({
      ...user,
      commissionPlan: CommissionPlan,
    }));
    return { users: formattedUsers, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    const user = await prisma.user.findFirst({
      where: { id, clinicId },
      include: {
        specialties: true,
        // --- INCLUSÃO ADICIONADA ---
        CommissionPlan: true,
        ProfessionalCouncil: true,
      },
    });
    // Formata a resposta para consistência
    if (user) {
      const { CommissionPlan, ProfessionalCouncil, ...rest } = user;
      return {
        ...rest,
        commissionPlan: CommissionPlan,
        professionalCouncil: ProfessionalCouncil,
      };
    }
    return null;
  }

  static async update(id: string, clinicId: string, data: any) {
    const { specialtyIds, ...userData } = data;
    await prisma.user.findFirstOrThrow({ where: { id, clinicId } });

    // Garante que o campo nulo não seja enviado como 'undefined' para o Prisma
    if (userData.commissionPlanId === "") userData.commissionPlanId = null;
    if (userData.professionalCouncilId === "")
      userData.professionalCouncilId = null;

    return prisma.user.update({
      where: { id },
      data: {
        ...userData,
        specialties:
          specialtyIds === undefined
            ? undefined
            : {
                set: specialtyIds?.map((id: string) => ({ id })) || [],
              },
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.user.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.user.delete({ where: { id } });
  }
}

```

