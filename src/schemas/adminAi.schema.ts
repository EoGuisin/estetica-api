// src/schemas/adminAi.schema.ts
import { z } from "zod";

export const createAiArticleSchema = z.object({
  title: z.string().min(3, "O título precisa ter pelo menos 3 caracteres."),
  content: z.string().min(10, "O conteúdo precisa ser mais descritivo."),
});

export type CreateAiArticleInput = z.infer<typeof createAiArticleSchema>;
