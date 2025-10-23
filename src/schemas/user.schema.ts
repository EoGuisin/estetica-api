import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z.string().min(3, "Nome completo é obrigatório."),
  email: z.string().email("Email inválido."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
  roleId: z.string().uuid("O papel é obrigatório."),
  isProfessional: z.boolean(),
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

  // --- CAMPOS ADICIONADOS ---
  commissionPlanId: z
    .string()
    .uuid("Plano de comissão inválido.")
    .optional()
    .nullable(),
  professionalCouncilId: z
    .string()
    .uuid("Conselho profissional inválido.")
    .optional()
    .nullable(),
  professionalCouncilRegistry: z
    .string()
    .min(1, "O número de registro é obrigatório se o conselho for selecionado.")
    .optional()
    .nullable(),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial();
