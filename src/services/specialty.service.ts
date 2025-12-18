import { prisma } from "../lib/prisma";

interface SpecialtyInput {
  name: string;
  professionalIds?: string[];
}

export class SpecialtyService {
  // Lista APENAS da clínica atual
  static async list(clinicId: string) {
    return prisma.specialty.findMany({
      where: {
        clinicId: clinicId, // <--- FILTRO DE TENANCY
      },
      include: {
        _count: {
          select: { professionals: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  // Busca ID garantindo que pertence à clínica
  static async getById(id: string, clinicId: string) {
    return prisma.specialty.findFirst({
      where: {
        id,
        clinicId, // <--- SEGURANÇA
      },
      include: {
        professionals: {
          select: { id: true, fullName: true }, // Traz o nome também para exibir no form
        },
      },
    });
  }

  // Cria vinculando à clínica
  static async create(data: SpecialtyInput, clinicId: string) {
    return prisma.specialty.create({
      data: {
        name: data.name,
        clinicId: clinicId, // <--- VINCULAÇÃO
        professionals: {
          connect: data.professionalIds?.map((id) => ({ id })) || [],
        },
      },
    });
  }

  // Atualiza verificando propriedade
  static async update(id: string, data: SpecialtyInput, clinicId: string) {
    // Garante que a especialidade é desta clínica antes de editar
    await prisma.specialty.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.specialty.update({
      where: { id },
      data: {
        name: data.name,
        professionals: {
          set: data.professionalIds?.map((id) => ({ id })) || [],
        },
      },
    });
  }

  // Deleta verificando propriedade
  static async delete(id: string, clinicId: string) {
    // Garante que a especialidade é desta clínica antes de deletar
    await prisma.specialty.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.specialty.delete({ where: { id } });
  }
}
