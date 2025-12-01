import { z } from "zod";

export const createClinicSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  taxId: z.string().min(11, "CNPJ/CPF inválido."),
});

export const updateClinicSchema = z.object({
  name: z.string().min(3).optional(),
  taxId: z.string().min(11).optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "PENDING_PAYMENT", "CANCELED"])
    .optional(),
});
