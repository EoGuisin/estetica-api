// src/services/user.service.ts
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

export class UserService {
  static async create(clinicId: string, data: any) {
    const { specialtyIds, password, ...userData } = data;
    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        clinicId,
        specialties: {
          connect: specialtyIds?.map((id: string) => ({ id })) || [],
        },
      },
    });
  }

  // Lista todos os usuários da clínica, não apenas profissionais
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    document?: string
  ) {
    const where: Prisma.UserWhereInput = { clinicId };

    if (name) where.fullName = { contains: name, mode: "insensitive" };
    if (document)
      where.OR = [
        { cpf: { contains: document } },
        { email: { contains: document } },
      ];

    const skip = (page - 1) * pageSize;
    const [users, totalCount] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: { specialties: true, role: true }, // Inclui o papel do usuário
        skip,
        take: pageSize,
        orderBy: { fullName: "asc" },
      }),
      prisma.user.count({ where }),
    ]);
    return { users, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.user.findFirst({
      where: { id, clinicId },
      include: { specialties: true },
    });
  }

  // (update e delete permanecem com a mesma lógica, mas agora para qualquer usuário)
  static async update(id: string, clinicId: string, data: any) {
    const { specialtyIds, ...userData } = data;
    await prisma.user.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.user.update({
      where: { id },
      data: {
        ...userData,
        specialties: {
          set: specialtyIds?.map((id: string) => ({ id })) || [],
        },
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    await prisma.user.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.user.delete({ where: { id } });
  }
}
