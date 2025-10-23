import { z } from "zod";

export const createProductSchema = z.object({
  name: z
    .string()
    .min(2, "O nome do produto deve ter no mínimo 2 caracteres.")
    .refine((val) => val.trim().length > 0, {
      message: "O nome do produto é obrigatório.",
    }),

  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),

  categoryId: z
    .string()
    .uuid("ID da categoria inválido.")
    .refine((val) => val.trim().length > 0, {
      message: "A categoria é obrigatória.",
    }),

  brandId: z
    .string()
    .uuid("ID da marca inválido.")
    .refine((val) => val.trim().length > 0, {
      message: "A marca é obrigatória.",
    }),

  lowStockThreshold: z
    .number()
    .int("O limiar de estoque baixo deve ser um número inteiro.")
    .min(0, "O limiar não pode ser negativo.")
    .optional()
    .nullable(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
