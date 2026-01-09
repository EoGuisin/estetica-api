// src/schemas/patient.schema.ts
import { z } from "zod";

const phoneSchema = z.object({
  number: z.string().min(10, "Número inválido."),
  isWhatsapp: z.boolean(),
});

const addressSchema = z.object({
  zipCode: z.string().length(8, "CEP inválido."),
  street: z.string().min(1, "Rua é obrigatória."),
  number: z.string().min(1, "Número é obrigatório."),
  neighborhood: z.string().min(1, "Bairro é obrigatório."),
  city: z.string().min(1, "Cidade é obrigatória."),
  state: z.string().min(1, "Estado é obrigatório."),
  complement: z.string().optional().nullable(), // Já estava correto
});

export const createPatientSchema = z.object({
  // CORREÇÃO: Adicionar .nullable() a todos os campos de texto opcionais
  imageUrl: z.string().optional().nullable(),
  name: z.string().min(3, "Nome completo é obrigatório."),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos."),
  birthDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Data de nascimento inválida."),
  email: z.string().email("E-mail inválido.").optional().nullable(),
  socialName: z.string().optional().nullable(),
  identityCard: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  ethnicity: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),

  phones: z.array(phoneSchema).min(1, "Pelo menos um telefone é obrigatório."),
  address: addressSchema,

  trafficSourceId: z
    .string()
    .uuid("Fonte de tráfego inválida.")
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),

  guardianName: z.string().optional().nullable(),
  guardianBirthDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Data inválida.")
    .optional()
    .nullable(),
});

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
