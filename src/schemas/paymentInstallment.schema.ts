import { z } from "zod";

// Enum deve espelhar o do Prisma, mas usamos aqui para validação
const PaymentMethod = z.enum([
  "CREDIT_CARD",
  "DEBIT_CARD",
  "BANK_TRANSFER",
  "CASH",
  "CHECK",
  "OTHER",
]);

// Schema para registrar o pagamento de uma parcela
export const registerPaymentSchema = z.object({
  paidAmount: z.coerce
    .number()
    .positive({ message: "O valor pago deve ser positivo." }),
  paymentDate: z
    .string({ message: "A data do pagamento é obrigatória." })
    .refine((d) => !Number.isNaN(Date.parse(d)), {
      message: "Formato de data inválido.",
    }),
  paymentMethod: PaymentMethod.refine((val) => !!val, {
    message: "O método de pagamento é obrigatório.",
  }),
  notes: z.string().optional().nullable(),
});

export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
