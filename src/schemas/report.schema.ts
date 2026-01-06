// src/schemas/report.schema.ts
import {
  PaymentStatus,
  StockMovementType,
  TransactionType,
} from "@prisma/client";
import { z } from "zod";

export const appointmentsReportQuerySchema = z.object({
  // Usamos z.string().date() para aceitar 'YYYY-MM-DD' do frontend
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  professionalId: z.string().uuid().optional(),
});

export const professionalValueReportQuerySchema = z.object({
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  professionalId: z.string().uuid({ message: "Profissional é obrigatório." }),
});

export const commissionReportQuerySchema = z.object({
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  professionalId: z.string().uuid({ message: "Profissional é obrigatório." }),
});

export const attendedPatientsReportQuerySchema = z.object({
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  professionalId: z.string().uuid().optional(),
  specialtyId: z.string().uuid().optional(),
});

const relevantStatus = z.enum([PaymentStatus.PENDING, PaymentStatus.OVERDUE]);

export const accountsReceivableReportQuerySchema = z.object({
  startDate: z
    .string()
    .date({ message: "Data de Vencimento inicial é obrigatória." }),
  endDate: z
    .string()
    .date({ message: "Data de Vencimento final é obrigatória." }),
  status: relevantStatus.optional(),
});

export const accountsPayableReportQuerySchema = z.object({
  startDate: z
    .string()
    .date({ message: "Data de Vencimento inicial é obrigatória." }),
  endDate: z
    .string()
    .date({ message: "Data de Vencimento final é obrigatória." }),
  status: relevantStatus.optional(),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
});

export const stockAvailabilityReportQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
});

const relevantType = z.enum([StockMovementType.ENTRY, StockMovementType.EXIT], {
  message: "O tipo (Entrada/Saída) é obrigatório.",
});

export const stockMovementReportQuerySchema = z.object({
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  type: relevantType,
  productId: z.string().uuid().optional(),
});

export const salesReportQuerySchema = z.object({
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  sellerId: z.string().uuid().optional(),
});

export const paymentMethodsReportQuerySchema = z.object({
  startDate: z
    .string()
    .date({ message: "Data de Pagamento inicial é obrigatória." }),
  endDate: z
    .string()
    .date({ message: "Data de Pagamento final é obrigatória." }),
});

export const inactivePatientsReportQuerySchema = z.object({
  // coerce.number() transforma a string da query (ex: "90") em número
  days: z.coerce
    .number()
    .int()
    .min(1, { message: "O número de dias deve ser ao menos 1." }),
});

// --- NOVO SCHEMA: FECHAMENTO/EXTRATO DE CAIXA ---
export const cashStatementReportQuerySchema = z.object({
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  bankAccountId: z.string().uuid().optional(),
  type: z
    .enum([
      TransactionType.REVENUE,
      TransactionType.EXPENSE,
      TransactionType.TRANSFER,
    ])
    .optional(),
});

export const expiredProductsReportQuerySchema = z.object({
  date: z.string().date().optional(),
  categoryId: z.string().uuid().optional(),
});
