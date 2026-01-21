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
    clinicId: string, // Certifique-se de que está recebendo o clinicId
    page: number,
    pageSize: number,
    name?: string
  ) {
    const skip = (page - 1) * pageSize;

    // AQUI ESTÁ O PONTO CRUCIAL:
    const where: Prisma.ProfessionalCouncilWhereInput = {
      clinicId: clinicId, // <--- OBRIGATÓRIO: Filtra apenas os registros da sua clínica
    };

    // Filtro opcional por nome (se houver pesquisa)
    if (name) {
      where.name = {
        contains: name,
        mode: "insensitive",
      };
    }

    const [items, totalCount] = await prisma.$transaction([
      prisma.professionalCouncil.findMany({
        where, // Aplica o filtro aqui
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.professionalCouncil.count({ where }), // Aplica o filtro aqui também
    ]);

    return {
      data: items,
      totalCount,
      page,
      pageSize,
    };
  }

  // CORREÇÃO: Adicionado clinicId para verificar permissão de visualização
  static async getById(id: string, clinicId: string) {
    return prisma.professionalCouncil.findFirst({
      where: {
        id,
        clinicId, // <--- Garante que você não consegue ver detalhes de outra clínica pelo ID na URL
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
    // 1. Tenta encontrar o registro que pertença especificamente a esta clínica
    const council = await prisma.professionalCouncil.findFirst({
      where: {
        id: id,
        clinicId: clinicId,
      },
    });

    // 2. Se não encontrar, lançamos um erro amigável que o Controller possa capturar
    if (!council) {
      // Você pode criar uma classe de erro customizada,
      // mas aqui vamos lançar um erro simples para o exemplo
      const error = new Error("Registro não encontrado ou permissão negada.");
      (error as any).code = "NOT_FOUND";
      throw error;
    }

    // 3. Se encontrou e pertence à clínica, deleta pelo ID único
    return prisma.professionalCouncil.delete({
      where: { id },
    });
  }
}
