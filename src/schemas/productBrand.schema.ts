import { z } from "zod";

export const createProductBrandSchema = z.object({
  name: z
    .string({ error: "O nome da marca é obrigatório." })
    .min(2, "O nome da marca deve ter no mínimo 2 caracteres.")
    .nonoptional(),
  description: z.string().optional().nullable(),
});

export const updateProductBrandSchema = createProductBrandSchema.partial();

export type CreateProductBrandInput = z.infer<typeof createProductBrandSchema>;
export type UpdateProductBrandInput = z.infer<typeof updateProductBrandSchema>;
