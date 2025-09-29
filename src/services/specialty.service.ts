// src/services/specialty.service.ts
import { prisma } from "../lib/prisma";

export class SpecialtyService {
  static async list() {
    return prisma.specialty.findMany({
      include: {
        _count: {
          select: { professionals: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  static async getById(id: string) {
    return prisma.specialty.findUnique({
      where: { id },
      include: {
        professionals: {
          select: { id: true },
        },
      },
    });
  }

  static async create(data: { name: string; professionalIds?: string[] }) {
    return prisma.specialty.create({
      data: {
        name: data.name,
        professionals: {
          connect: data.professionalIds?.map((id) => ({ id })) || [],
        },
      },
    });
  }

  static async update(
    id: string,
    data: { name: string; professionalIds?: string[] }
  ) {
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

  static async delete(id: string) {
    return prisma.specialty.delete({ where: { id } });
  }
}
