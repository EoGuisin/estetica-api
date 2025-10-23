import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createTemplateSchema,
  updateTemplateSchema,
} from "../schemas/specialtyTemplate.schema";
import { DocumentType } from "@prisma/client";

export class SpecialtyTemplateService {
  static async create(data: z.infer<typeof createTemplateSchema>) {
    return prisma.specialtyTemplate.create({
      data,
      include: {
        specialty: true,
      },
    });
  }

  static async findMany(specialtyId: string, type?: DocumentType) {
    return prisma.specialtyTemplate.findMany({
      where: { specialtyId, ...(type && { type }) },
      orderBy: { createdAt: "desc" },
    });
  }

  static async findById(templateId: string) {
    return prisma.specialtyTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: {
        specialty: true,
      },
    });
  }

  static async update(
    templateId: string,
    data: z.infer<typeof updateTemplateSchema>
  ) {
    return prisma.specialtyTemplate.update({
      where: { id: templateId },
      data,
    });
  }

  static async delete(templateId: string) {
    // Check if template is being used
    const usageCount = await prisma.patientDocument.count({
      where: { templateId },
    });

    if (usageCount > 0) {
      throw new Error(
        `Este template está sendo usado em ${usageCount} documento(s) e não pode ser excluído.`
      );
    }

    return prisma.specialtyTemplate.delete({
      where: { id: templateId },
    });
  }
}
