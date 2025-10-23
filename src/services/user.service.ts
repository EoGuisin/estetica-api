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
        include: {
          specialties: true,
          role: true,
          // --- INCLUSÃO ADICIONADA ---
          CommissionPlan: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { fullName: "asc" },
      }),
      prisma.user.count({ where }),
    ]);
    // Renomeia o campo para facilitar no frontend (de CommissionPlan para commissionPlan)
    const formattedUsers = users.map(({ CommissionPlan, ...user }) => ({
      ...user,
      commissionPlan: CommissionPlan,
    }));
    return { users: formattedUsers, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    const user = await prisma.user.findFirst({
      where: { id, clinicId },
      include: {
        specialties: true,
        // --- INCLUSÃO ADICIONADA ---
        CommissionPlan: true,
        ProfessionalCouncil: true,
      },
    });
    // Formata a resposta para consistência
    if (user) {
      const { CommissionPlan, ProfessionalCouncil, ...rest } = user;
      return {
        ...rest,
        commissionPlan: CommissionPlan,
        professionalCouncil: ProfessionalCouncil,
      };
    }
    return null;
  }

  static async update(id: string, clinicId: string, data: any) {
    const { specialtyIds, ...userData } = data;
    await prisma.user.findFirstOrThrow({ where: { id, clinicId } });

    // Garante que o campo nulo não seja enviado como 'undefined' para o Prisma
    if (userData.commissionPlanId === "") userData.commissionPlanId = null;
    if (userData.professionalCouncilId === "")
      userData.professionalCouncilId = null;

    return prisma.user.update({
      where: { id },
      data: {
        ...userData,
        specialties:
          specialtyIds === undefined
            ? undefined
            : {
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
