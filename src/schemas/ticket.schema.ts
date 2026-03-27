import { z } from "zod";

const attachmentSchema = z.object({
  fileName: z.string(),
  filePath: z.string().url({ message: "O caminho do arquivo deve ser uma URL válida." }),
  fileType: z.string(),
  size: z.number()
});

export const createTicketSchema = z.object({
  title: z.string().min(5, { message: "O título deve ter pelo menos 5 caracteres." }),
  description: z.string().min(10, { message: "Descreva o problema com mais detalhes." }),
  category: z.enum(["DOUBT", "BUG", "FINANCIAL", "SUGGESTION", "OTHER"]).default("DOUBT"),
  attachments: z.array(attachmentSchema).optional(), // Agora aceita anexos na abertura do ticket
});

export const addTicketMessageSchema = z.object({
  content: z.string().min(1, { message: "A mensagem não pode ser vazia." }),
  isInternal: z.boolean().default(false).optional(),
  attachments: z.array(attachmentSchema).optional(), // Agora aceita anexos no meio do chat
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;