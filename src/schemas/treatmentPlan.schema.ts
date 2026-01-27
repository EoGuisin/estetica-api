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
  isBudget: z.boolean().optional().default(false),
});

export type CreateTreatmentPlanInput = z.infer<
  typeof createTreatmentPlanSchema
>;
