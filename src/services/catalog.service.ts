// src/services/catalog.service.ts
import { prisma } from "../lib/prisma";

type CatalogModel =
  | "specialty"
  | "appointmentType"
  | "trafficSource"
  | "procedure";

export class CatalogService {
  static async getById(model: CatalogModel, id: string) {
    // @ts-ignore
    return prisma[model].findUnique({ where: { id } });
  }
  // Método genérico para listar itens de qualquer catálogo
  static async list(model: CatalogModel) {
    // @ts-ignore - Usamos um truque para acessar o model do prisma dinamicamente
    return prisma[model].findMany({ orderBy: { name: "asc" } });
  }

  // Método genérico para criar itens
  static async create(model: CatalogModel, data: { name: string }) {
    // @ts-ignore
    return prisma[model].create({ data });
  }

  // Método genérico para atualizar
  static async update(model: CatalogModel, id: string, data: { name: string }) {
    // @ts-ignore
    return prisma[model].update({ where: { id }, data });
  }

  // Método genérico para deletar
  static async delete(model: CatalogModel, id: string) {
    // @ts-ignore
    return prisma[model].delete({ where: { id } });
  }

  // Métodos específicos para Procedimentos, que são mais complexos
  static async listProcedures() {
    return prisma.procedure.findMany({
      include: { specialty: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  static async createProcedure(data: any) {
    return prisma.procedure.create({ data });
  }

  static async updateProcedure(id: string, data: any) {
    return prisma.procedure.update({ where: { id }, data });
  }
}
