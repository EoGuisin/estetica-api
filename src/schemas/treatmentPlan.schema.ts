// src/schemas/treatmentPlan.schema.ts
import { z } from "zod";

const procedureItemSchema = z.object({
  procedureId: z.string().uuid(),
  unitPrice: z.coerce.number(),
  contractedSessions: z.coerce.number().int().min(1),
  followUps: z.coerce.number().int().min(0).default(0),
});

export const createTreatmentPlanSchema = z.object({
  patientId: z.string().uuid(),
  sellerId: z.string().uuid(),
  subtotal: z.coerce.number(),
  discountAmount: z.coerce.number().optional().nullable(),
  total: z.coerce.number(),
  procedures: z
    .array(procedureItemSchema)
    .min(1, "Adicione pelo menos um procedimento."),
});
