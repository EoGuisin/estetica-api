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
