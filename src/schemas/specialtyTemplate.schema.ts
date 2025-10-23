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
