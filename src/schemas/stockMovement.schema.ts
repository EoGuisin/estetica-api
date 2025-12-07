import { z } from "zod";

const StockMovementType = z.enum(["ENTRY", "EXIT"]);

export const createStockMovementSchema = z
  .object({
    productId: z
      .string({ message: "O produto é obrigatório." })
      .uuid({ message: "ID do produto inválido." }),
    type: StockMovementType,
    quantity: z.coerce
      .number()
      .int()
      .positive({ message: "A quantidade deve ser maior que zero." }),
    date: z.string({ message: "A data é obrigatória." }),

    // Note que mantemos optional/nullable na definição base,
    // mas vamos validar condicionalmente abaixo
    totalValue: z.coerce.number().positive().optional().nullable(),

    invoiceNumber: z.string().optional().nullable(),

    supplierId: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),

    // Agora é obrigatório passar a data se for entrada
    expenseDueDate: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // REGRA DE NEGÓCIO: Se for ENTRADA, precisa de valor e data de vencimento
    if (data.type === "ENTRY") {
      if (!data.totalValue || data.totalValue <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Para entradas, o Valor Total é obrigatório e deve ser positivo.",
          path: ["totalValue"],
        });
      }
      if (!data.expenseDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Para entradas, a Data de Vencimento da despesa é obrigatória.",
          path: ["expenseDueDate"],
        });
      }
    }
  });

export const updateStockMovementSchema = createStockMovementSchema.partial();
export type CreateStockMovementInput = z.infer<
  typeof createStockMovementSchema
>;
