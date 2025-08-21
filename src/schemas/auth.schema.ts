import { z } from "zod";

// Schema de Login
export const loginSchema = z.object({
  email: z.string().email({ message: "Por favor, forneça um email válido." }),
  password: z
    .string()
    .min(6, { message: "A senha deve ter no mínimo 6 caracteres." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Schema de Cadastro
export const registerSchema = z.object({
  clinicName: z
    .string()
    .min(3, { message: "O nome da clínica deve ter no mínimo 3 caracteres." }),
  taxId: z.string().length(14, { message: "O CNPJ deve ter 14 dígitos." }), // CNPJ
  fullName: z.string().min(3, { message: "O nome completo é obrigatório." }),
  email: z.string().email({ message: "Por favor, forneça um email válido." }),
  password: z
    .string()
    .min(8, { message: "A senha deve ter no mínimo 8 caracteres." }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Por favor, forneça um email válido." }),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Schema para Redefinir a Senha
export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "O token é obrigatório." }),
  password: z
    .string()
    .min(8, { message: "A nova senha deve ter no mínimo 8 caracteres." }),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
