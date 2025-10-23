import { z } from "zod";

export const createExpenseCategorySchema = z.object({
  name: z
    .string({ message: "O nome é obrigatório." })
    .min(2, { message: "Nome muito curto." }),
});

export const updateExpenseCategorySchema =
  createExpenseCategorySchema.partial();

export type CreateExpenseCategoryInput = z.infer<
  typeof createExpenseCategorySchema
>;
export type UpdateExpenseCategoryInput = z.infer<
  typeof updateExpenseCategorySchema
>;
