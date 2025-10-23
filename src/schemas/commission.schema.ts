import { z } from "zod";

export const commissionTierSchema = z.object({
  minThreshold: z
    .number()
    .min(0, "O valor mínimo não pode ser negativo.")
    .refine((val) => val !== undefined && val !== null, {
      message: "O valor mínimo é obrigatório.",
    }),
  maxThreshold: z
    .number()
    .min(0, "O valor máximo não pode ser negativo.")
    .optional()
    .nullable(),
  percentage: z
    .number()
    .min(0, "A porcentagem não pode ser negativa.")
    .max(100, "A porcentagem não pode ser maior que 100.")
    .refine((val) => val !== undefined && val !== null, {
      message: "A porcentagem é obrigatória.",
    }),
});

export const createCommissionPlanSchema = z.object({
  name: z
    .string()
    .min(3, "O nome do plano deve ter no mínimo 3 caracteres.")
    .refine((val) => !!val, {
      message: "O nome do plano é obrigatório.",
    }),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  tiers: z
    .array(commissionTierSchema)
    .min(1, "O plano deve ter ao menos uma faixa de comissão."),
});

export const updateCommissionPlanSchema = createCommissionPlanSchema.partial();

export type CreateCommissionPlanInput = z.infer<
  typeof createCommissionPlanSchema
>;
export type UpdateCommissionPlanInput = z.infer<
  typeof updateCommissionPlanSchema
>;
