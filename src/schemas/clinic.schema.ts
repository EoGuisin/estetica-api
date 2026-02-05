import { z } from "zod";

// Regex aceita qualquer hora de 00:00 até 23:59
const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const createClinicSchema = z.object({
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres."),
  taxId: z.string().min(11, "CNPJ/CPF inválido."),

  allowParallelAppointments: z.boolean().optional(),
  parallelAppointmentsLimit: z.number().int().min(1).optional(),

  // Aceita "08:00", "18:00", "18:30", etc.
  openingHour: z
    .string()
    .regex(timeFormat, "Horário inválido (use HH:mm, ex: 08:00).")
    .optional(),
  closingHour: z
    .string()
    .regex(timeFormat, "Horário inválido (use HH:mm, ex: 18:00).")
    .optional(),
});

export const updateClinicSchema = z.object({
  name: z.string().min(3).optional(),
  taxId: z.string().min(11).optional(),
  status: z
    .enum(["ACTIVE", "INACTIVE", "PENDING_PAYMENT", "CANCELED"])
    .optional(),

  allowParallelAppointments: z.boolean().optional(),
  parallelAppointmentsLimit: z.number().int().min(1).optional(),

  openingHour: z
    .string()
    .regex(timeFormat, "Horário inválido (use HH:mm).")
    .optional(),
  closingHour: z
    .string()
    .regex(timeFormat, "Horário inválido (use HH:mm).")
    .optional(),
});
