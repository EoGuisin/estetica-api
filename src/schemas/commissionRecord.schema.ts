import { z } from "zod";

// Schema para marcar uma comissão como paga
export const markCommissionAsPaidSchema = z.object({
  paymentDate: z
    .string({ message: "A data do pagamento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
});

export type MarkCommissionAsPaidInput = z.infer<
  typeof markCommissionAsPaidSchema
>;
