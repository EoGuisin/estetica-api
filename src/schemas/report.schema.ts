// src/schemas/report.schema.ts
import { PaymentStatus } from "@prisma/client";
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
