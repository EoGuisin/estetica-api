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
