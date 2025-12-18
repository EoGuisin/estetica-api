import { prisma } from "../lib/prisma";

type CatalogModel =
  | "specialty"
  | "appointmentType"
  | "trafficSource"
  | "procedure"
  | "role";

export class CatalogService {
  // CORREÇÃO: Adicionado clinicId
  static async getById(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    return prisma[model].findFirst({
      where: {
        id,
        OR: [{ clinicId: clinicId }, { clinicId: null }],
      },
    });
  }

  static async list(model: CatalogModel, clinicId: string) {
    // @ts-ignore
    return prisma[model].findMany({
      where: {
        OR: [{ clinicId: clinicId }, { clinicId: null }],
      },
      orderBy: { name: "asc" },
    });
  }

  // CORREÇÃO: Ordem ajustada para (model, data, clinicId)
  static async create(
    model: CatalogModel,
    data: { name: string },
    clinicId: string
  ) {
    // @ts-ignore
    return prisma[model].create({
      data: { ...data, clinicId },
    });
  }

  // CORREÇÃO: Adicionado clinicId e verificação de propriedade
  static async update(
    model: CatalogModel,
    id: string,
    data: { name: string },
    clinicId: string
  ) {
    // @ts-ignore
    // Verifica se pertence à clínica antes de editar (não pode editar globais)
    await prisma[model].findFirstOrThrow({
      where: { id, clinicId },
    });

    // @ts-ignore
    return prisma[model].update({ where: { id }, data });
  }

  // CORREÇÃO: Adicionado clinicId e verificação de propriedade
  static async delete(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    await prisma[model].findFirstOrThrow({
      where: { id, clinicId },
    });

    // @ts-ignore
    return prisma[model].delete({ where: { id } });
  }

  // Métodos específicos para Procedimentos

  // CORREÇÃO: Adicionado clinicId
  static async listProcedures(clinicId: string) {
    return prisma.procedure.findMany({
      where: {
        OR: [{ clinicId: clinicId }, { clinicId: null }],
      },
      include: { specialty: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  // CORREÇÃO: Adicionado clinicId
  static async createProcedure(data: any, clinicId: string) {
    return prisma.procedure.create({
      data: { ...data, clinicId },
    });
  }

  // CORREÇÃO: Adicionado clinicId
  static async updateProcedure(id: string, data: any, clinicId: string) {
    // Garante propriedade
    await prisma.procedure.findFirstOrThrow({
      where: { id, clinicId },
    });
    return prisma.procedure.update({ where: { id }, data });
  }
}
