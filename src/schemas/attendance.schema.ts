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
