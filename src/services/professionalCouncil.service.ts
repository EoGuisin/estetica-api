import { prisma } from "../lib/prisma";
import {
  CreateProfessionalCouncilInput,
  UpdateProfessionalCouncilInput,
} from "../schemas/professionalCouncil.schema";
import { Prisma } from "@prisma/client";

export class ProfessionalCouncilService {
  static async create(data: CreateProfessionalCouncilInput) {
    return prisma.professionalCouncil.create({ data });
  }

  static async list(page: number, pageSize: number, name?: string) {
    const where: Prisma.ProfessionalCouncilWhereInput = {};
    if (name) {
      where.name = { contains: name, mode: "insensitive" };
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

  static async getById(id: string) {
    return prisma.professionalCouncil.findUnique({ where: { id } });
  }

  static async update(id: string, data: UpdateProfessionalCouncilInput) {
    await prisma.professionalCouncil.findUniqueOrThrow({ where: { id } });
    return prisma.professionalCouncil.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    await prisma.professionalCouncil.findUniqueOrThrow({ where: { id } });
    return prisma.professionalCouncil.delete({ where: { id } });
  }
}
