// src/schemas/specialty.schema.ts
import { z } from "zod";

export const specialtySchema = z.object({
  name: z
    .string()
    .min(2, { message: "O nome deve ter no mínimo 2 caracteres." }),
  professionalIds: z.array(z.string().uuid()).optional(),
});
