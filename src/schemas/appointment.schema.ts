// src/schemas/appointment.schema.ts
import { z } from "zod";

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  professionalId: z.string().uuid("ID do profissional inválido"),
  appointmentTypeId: z.string().uuid("ID do tipo de agendamento inválido"),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Formato de data inválido",
  }),
  startTime: z
    .string()
    .regex(
      /^([0-1]?\d|2[0-3]):[0-5]\d$/,
      "Formato de hora de início inválido (HH:MM)"
    ),
  endTime: z
    .string()
    .regex(
      /^([0-1]?\d|2[0-3]):[0-5]\d$/,
      "Formato de hora de fim inválido (HH:MM)"
    ),
  notes: z.string().optional().nullable(),
  treatmentPlanId: z.string().uuid().optional().nullable(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
