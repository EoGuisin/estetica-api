// src/schemas/admin.schema.ts
import { z } from "zod";

export const createTestAccountSchema = z.object({
  clinicName: z.string().min(3, "O nome da clínica é obrigatório"),
  taxId: z.string().min(11, "CNPJ/CPF inválido"), // Pode ajustar o length conforme necessidade
  fullName: z.string().min(3, "Nome completo é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  isProfessional: z.boolean().default(true),
});

export type CreateTestAccountInput = z.infer<typeof createTestAccountSchema>;
