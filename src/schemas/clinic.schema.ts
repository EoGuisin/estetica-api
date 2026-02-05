import { z } from "zod";

export const createClinicSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  taxId: z.string().min(11, "CNPJ/CPF inválido."),

  allowParallelAppointments: z.boolean().default(false),
  parallelAppointmentsLimit: z.number().int().min(1).default(1),
});

export const updateClinicSchema = z.object({
  name: z.string().min(3).optional(),
  taxId: z.string().min(11).optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "PENDING_PAYMENT", "CANCELED"])
    .optional(),

  allowParallelAppointments: z.boolean().optional(),
  parallelAppointmentsLimit: z.number().int().min(1).optional(),
});
