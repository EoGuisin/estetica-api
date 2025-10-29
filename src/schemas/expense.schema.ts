import { z } from "zod";

export const createExpenseSchema = z.object({
  description: z
    .string({ message: "A descrição é obrigatória." })
    .min(3, { message: "Descrição muito curta." }),
  amount: z.coerce.number().positive({ message: "O valor deve ser positivo." }),
  dueDate: z
    .string({ message: "A data de vencimento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
  supplierId: z.preprocess(
    (val) => (val === "" ? null : val),
    z
      .string()
      .uuid({ message: "ID do fornecedor inválido." })
      .optional()
      .nullable()
  ),
  categoryId: z.preprocess(
    (val) => (val === "" ? null : val),
    z
      .string()
      .uuid({ message: "ID da categoria inválida." })
      .optional()
      .nullable()
  ),
  notes: z.string().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const markExpenseAsPaidSchema = z.object({
  paymentDate: z
    .string({ message: "A data do pagamento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
  bankAccountId: z
    .string({ message: "A conta de destino é obrigatória." })
    .uuid({ message: "Conta inválida." }),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type MarkExpenseAsPaidInput = z.infer<typeof markExpenseAsPaidSchema>;
