import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email({ message: 'Por favor, forneça um email válido.' }),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres.' }),
});

// Tipo inferido do schema para usar no TypeScript
export type LoginInput = z.infer<typeof loginSchema>;