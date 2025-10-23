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
