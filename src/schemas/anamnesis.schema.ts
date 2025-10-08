import { z } from "zod";

const questionTypeEnum = z.enum([
  "YES_NO",
  "SHORT_TEXT",
  "LONG_TEXT",
  "SINGLE_SELECT",
  "MULTIPLE_SELECT",
  "SCALE",
  "DATE",
]);

const questionSchema: z.ZodType<any> = z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1, "Pergunta é obrigatória"),
  description: z.string().optional().nullable(),
  type: questionTypeEnum,
  isRequired: z.boolean().default(false),
  order: z.number().int(),
  options: z.any().optional().nullable(),
  parentQuestionId: z.string().uuid().optional().nullable(),
  showCondition: z.any().optional().nullable(),
  subQuestions: z.lazy(() => z.array(questionSchema)).optional(),
});

const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Título da seção é obrigatório"),
  order: z.number().int(),
  questions: z.array(questionSchema),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Nome do template é obrigatório"),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sections: z.array(sectionSchema),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createAssessmentSchema = z.object({
  templateId: z.string().uuid(),
  responses: z.record(z.string().uuid(), z.any()),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).default("IN_PROGRESS"),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
