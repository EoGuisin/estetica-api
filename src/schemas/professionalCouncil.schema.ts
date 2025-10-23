import { z } from "zod";

export const createProfessionalCouncilSchema = z.object({
  name: z.string().min(2, "O nome do conselho é obrigatório."),
  description: z.string().optional().nullable(),
});

export const updateProfessionalCouncilSchema =
  createProfessionalCouncilSchema.partial();

export type CreateProfessionalCouncilInput = z.infer<
  typeof createProfessionalCouncilSchema
>;
export type UpdateProfessionalCouncilInput = z.infer<
  typeof updateProfessionalCouncilSchema
>;
