import { z } from "zod";

export const openSessionSchema = z.object({
  bankAccountId: z.string({ message: "A conta/caixa é obrigatória." }).uuid(),
  observedOpening: z.coerce
    .number({ message: "O saldo inicial é obrigatório." })
    .min(0, "O saldo inicial não pode ser negativo."),
});

export const closeSessionSchema = z.object({
  observedClosing: z.coerce
    .number({ message: "O saldo de fechamento é obrigatório." })
    .min(0, "O saldo de fechamento não pode ser negativo."),
  notes: z.string().optional().nullable(),
});

export const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const bankAccountParamsSchema = z.object({
  bankAccountId: z.string().uuid(),
});

export const listSessionsQuerySchema = z.object({
  page: z.string().optional().default("1"),
  pageSize: z.string().optional().default("10"),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  bankAccountId: z.string().uuid().optional(),
});
