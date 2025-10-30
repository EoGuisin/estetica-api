import { z } from "zod";

export const createBankAccountSchema = z.object({
  name: z.string().min(2, "O nome da conta é obrigatório."),
  balance: z.coerce.number().min(0, "O saldo inicial deve ser zero ou maior."),
});

export const updateBankAccountSchema = z.object({
  name: z.string().min(2, "O nome da conta é obrigatório.").optional(),
});

export const bankAccountParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listBankAccountQuerySchema = z.object({
  page: z.string().optional().default("1"),
  pageSize: z.string().optional().default("10"),
  name: z.string().optional(),
});
