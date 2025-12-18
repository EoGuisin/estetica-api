import { prisma } from "../lib/prisma";
import {
  CreateProfessionalCouncilInput,
  UpdateProfessionalCouncilInput,
} from "../schemas/professionalCouncil.schema";
import { Prisma } from "@prisma/client";

export class ProfessionalCouncilService {
  // CORREÇÃO: Ordem dos parâmetros ajustada para (data, clinicId)
  static async create(data: CreateProfessionalCouncilInput, clinicId: string) {
    return prisma.professionalCouncil.create({
      data: { ...data, clinicId },
    });
  }

  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string
  ) {
    // Filtra: Da clínica OU Global (null)
    const where: Prisma.ProfessionalCouncilWhereInput = {
      OR: [{ clinicId: clinicId }, { clinicId: null }],
    };

    if (name) {
      // AND para combinar a busca por nome com o filtro de tenancy
      where.AND = [{ name: { contains: name, mode: "insensitive" } }];
    }

    const skip = (page - 1) * pageSize;
    const [data, totalCount] = await prisma.$transaction([
      prisma.professionalCouncil.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.professionalCouncil.count({ where }),
    ]);

    return { data, totalCount };
  }

  // CORREÇÃO: Adicionado clinicId para verificar permissão de visualização
  static async getById(id: string, clinicId: string) {
    return prisma.professionalCouncil.findFirst({
      where: {
        id,
        OR: [{ clinicId: clinicId }, { clinicId: null }],
      },
    });
  }

  // CORREÇÃO: Adicionado clinicId para garantir que só edita o próprio registro
  static async update(
    id: string,
    data: UpdateProfessionalCouncilInput,
    clinicId: string
  ) {
    // Garante que o registro pertence à clínica antes de atualizar
    await prisma.professionalCouncil.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.professionalCouncil.update({
      where: { id },
      data,
    });
  }

  // CORREÇÃO: Adicionado clinicId para garantir que só deleta o próprio registro
  static async delete(id: string, clinicId: string) {
    // Garante que o registro pertence à clínica antes de deletar
    await prisma.professionalCouncil.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.professionalCouncil.delete({ where: { id } });
  }
}
