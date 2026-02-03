import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z.string().min(3, "Nome completo é obrigatório."),
  email: z.string().email("Email inválido."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
  roleId: z.string().uuid("O papel é obrigatório."),
  isProfessional: z.boolean(),
  clinicIds: z
    .array(z.string().uuid())
    .min(1, "Selecione pelo menos uma clínica."),
  cpf: z.string().length(11, "CPF deve ter 11 dígitos.").optional().nullable(),
  phone: z.string().min(10, "Telefone inválido.").optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.")
    .optional()
    .nullable(),
  scheduleStartHour: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  scheduleEndHour: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  appointmentDuration: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  specialtyIds: z.array(z.string().uuid()).optional(),

  commissionPlanId: z.string().uuid().optional().nullable().or(z.literal("")), // Aceita string vazia vinda do select

  professionalCouncilId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("")), // Agora não é mais obrigatório e aceita ""

  professionalCouncilRegistry: z.string().optional().nullable(),
  signatureImagePath: z.string().optional().nullable(),
  workingDays: z.array(z.string()).optional(),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial();
