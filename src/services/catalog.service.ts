import { prisma } from "../lib/prisma";

type CatalogModel =
  | "specialty"
  | "appointmentType"
  | "trafficSource"
  | "procedure"
  | "role";

export class CatalogService {
  // Busca item garantindo que pertence à clínica
  static async getById(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    return prisma[model].findFirst({
      where: {
        id,
        clinicId, // <--- REMOVIDO O 'OR null'. Agora é estrito.
      },
    });
  }

  // Lista APENAS itens da clínica
  static async list(model: CatalogModel, clinicId: string) {
    // @ts-ignore
    return prisma[model].findMany({
      where: {
        clinicId: clinicId,
      },
      orderBy: { name: "asc" },
    });
  }

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

  static async update(
    model: CatalogModel,
    id: string,
    data: { name: string },
    clinicId: string
  ) {
    // @ts-ignore
    await prisma[model].findFirstOrThrow({ where: { id, clinicId } });
    // @ts-ignore
    return prisma[model].update({ where: { id }, data });
  }

  static async delete(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    await prisma[model].findFirstOrThrow({ where: { id, clinicId } });
    // @ts-ignore
    return prisma[model].delete({ where: { id } });
  }

  // --- PROCEDIMENTOS (Correção do Item 1) ---

  static async listProcedures(clinicId: string) {
    return prisma.procedure.findMany({
      where: {
        clinicId, // <--- Apenas desta clínica
      },
      include: { specialty: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  static async createProcedure(data: any, clinicId: string) {
    return prisma.procedure.create({
      data: { ...data, clinicId },
    });
  }

  static async updateProcedure(id: string, data: any, clinicId: string) {
    await prisma.procedure.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.procedure.update({ where: { id }, data });
  }
}
