import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z
    .string({ error: "O nome do fornecedor é obrigatório." })
    .min(2, "O nome do fornecedor deve ter no mínimo 2 caracteres.")
    .nonoptional(),
  description: z.string().optional().nullable(),
  // Campos extras que podem ser úteis
  // taxId: z.string().optional().nullable(), // CNPJ
  // email: z.string().email("Email inválido.").optional().nullable(),
  // phone: z.string().optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
