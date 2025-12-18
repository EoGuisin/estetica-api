import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createTemplateSchema,
  updateTemplateSchema,
} from "../schemas/specialtyTemplate.schema";
import { DocumentType } from "@prisma/client";

export class SpecialtyTemplateService {
  // CORREÇÃO: Receber clinicId
  static async create(
    data: z.infer<typeof createTemplateSchema>,
    clinicId: string
  ) {
    // AQUI O ERRO PROVÁVEL:
    // O prisma.specialtyTemplate.create precisa receber o 'clinicId' no 'data'.
    // Mas o Zod schema 'createTemplateSchema' NÃO tem clinicId.
    // Então precisamos injetá-lo manualmente.

    return prisma.specialtyTemplate.create({
      data: {
        ...data,
        clinicId, // <--- GARANTA QUE ISSO ESTÁ AQUI
      },
      include: {
        specialty: true,
      },
    });
  }

  static async findMany(
    specialtyId: string,
    clinicId: string,
    type?: DocumentType
  ) {
    return prisma.specialtyTemplate.findMany({
      where: {
        specialtyId,
        clinicId, // <--- GARANTA O FILTRO POR CLÍNICA
        ...(type && { type }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // CORREÇÃO: Validar propriedade
  static async findById(templateId: string, clinicId: string) {
    return prisma.specialtyTemplate.findFirstOrThrow({
      where: {
        id: templateId,
        clinicId, // <--- Garante que só acessa se for da clínica
      },
      include: {
        specialty: true,
      },
    });
  }

  // CORREÇÃO: Validar propriedade antes de atualizar
  static async update(
    templateId: string,
    data: z.infer<typeof updateTemplateSchema>,
    clinicId: string
  ) {
    // Verifica existência e propriedade
    await prisma.specialtyTemplate.findFirstOrThrow({
      where: { id: templateId, clinicId },
    });

    return prisma.specialtyTemplate.update({
      where: { id: templateId },
      data,
    });
  }

  // CORREÇÃO: Validar propriedade antes de deletar
  static async delete(templateId: string, clinicId: string) {
    // 1. Verifica se o template pertence à clínica
    await prisma.specialtyTemplate.findFirstOrThrow({
      where: { id: templateId, clinicId },
    });

    // 2. Verifica se está em uso (Regra de Negócio)
    const usageCount = await prisma.patientDocument.count({
      where: { templateId },
    });

    if (usageCount > 0) {
      // Retorna uma mensagem clara que o frontend possa exibir
      throw new Error(
        `Este template não pode ser excluído pois foi usado em ${usageCount} documento(s).`
      );
    }

    return prisma.specialtyTemplate.delete({
      where: { id: templateId },
    });
  }
}
