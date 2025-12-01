// src/schemas/account.schema.ts
import { z } from "zod";

export const createClinicSchema = z.object({
  name: z.string().min(3, { message: "O nome da clínica é obrigatório." }),
  taxId: z.string().length(14, { message: "O CNPJ deve ter 14 dígitos." }),
  // Você pode adicionar mais campos aqui, como endereço
});

export type CreateClinicInput = z.infer<typeof createClinicSchema>;
