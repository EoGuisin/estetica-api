import { z } from "zod";

const StockMovementType = z.enum(["ENTRY", "EXIT"]);

export const createStockMovementSchema = z.object({
  productId: z
    .string({ message: "O produto é obrigatório." })
    .uuid({ message: "ID do produto inválido." }),
  type: StockMovementType,
  quantity: z.coerce
    .number()
    .int({ message: "A quantidade deve ser um número inteiro." })
    .positive({ message: "A quantidade deve ser maior que zero." }),
  date: z
    .string({ message: "A data é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),

  totalValue: z.coerce
    .number()
    .positive({ message: "O valor deve ser positivo." })
    .optional()
    .nullable(),
  invoiceNumber: z.string().optional().nullable(),

  supplierId: z.preprocess(
    (val) => (val === "" ? null : val),
    z
      .string()
      .uuid({ message: "ID do fornecedor inválido." })
      .optional()
      .nullable()
  ),

  notes: z.string().optional().nullable(),
});

export const updateStockMovementSchema = createStockMovementSchema.partial();
export type CreateStockMovementInput = z.infer<
  typeof createStockMovementSchema
>;
