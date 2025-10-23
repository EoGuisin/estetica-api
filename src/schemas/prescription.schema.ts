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
