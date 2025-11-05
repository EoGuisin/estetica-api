// src/schemas/report.schema.ts
import { z } from "zod";

export const appointmentsReportQuerySchema = z.object({
  // Usamos z.string().date() para aceitar 'YYYY-MM-DD' do frontend
  startDate: z.string().date({ message: "Data inicial é obrigatória." }),
  endDate: z.string().date({ message: "Data final é obrigatória." }),
  professionalId: z.string().uuid().optional(),
});
