import { z } from "zod";

export const createProductCategorySchema = z.object({
  name: z
    .string({ error: "O nome da categoria é obrigatório." })
    .min(2, "O nome da categoria deve ter no mínimo 2 caracteres.")
    .nonoptional(),
  description: z.string().optional().nullable(),
});

export const updateProductCategorySchema =
  createProductCategorySchema.partial();

export type CreateProductCategoryInput = z.infer<
  typeof createProductCategorySchema
>;
export type UpdateProductCategoryInput = z.infer<
  typeof updateProductCategorySchema
>;
