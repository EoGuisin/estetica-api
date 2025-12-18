import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { supabase } from "../lib/supabase";
import { MultipartFile } from "@fastify/multipart";

const SIGNATURES_BUCKET = "signatures";

export class UserService {
  static async create(clinicId: string, data: any) {
    // Extrai signatureImagePath junto com os outros dados
    const { specialtyIds, password, signatureImagePath, ...userData } = data;
    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        clinicId,
        // Salva o caminho da assinatura
        signatureImagePath: signatureImagePath || null,
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
    // 1. Primeiro, descobrimos quem é o Dono da Conta dessa Clínica
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });

    const ownerId = clinic?.account?.ownerId;

    const where: Prisma.UserWhereInput = {
      AND: [
        {
          OR: [
            { clinicId: clinicId },
            ...(ownerId
              ? [{ id: ownerId, isProfessional: true }]
              : []),
          ],
        },
      ],
    };

    if (name) {
      (where.AND as Prisma.UserWhereInput[]).push({
        fullName: { contains: name, mode: "insensitive" },
      });
    }

    if (document) {
      (where.AND as Prisma.UserWhereInput[]).push({
        OR: [
          { cpf: { contains: document } },
          { email: { contains: document } },
        ],
      });
    }

    const skip = (page - 1) * pageSize;

    const [users, totalCount] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: {
          specialties: true,
          role: true,
          CommissionPlan: { select: { name: true } },
        },
        skip,
        take: pageSize,
        orderBy: { fullName: "asc" },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map(({ CommissionPlan, ...user }) => ({
      ...user,
      commissionPlan: CommissionPlan,
    }));

    return { users: formattedUsers, totalCount };
  }

  static async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        specialties: true,
        CommissionPlan: true,
        ProfessionalCouncil: true,
      },
    });

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

  static async update(id: string, data: any) {
    // Extrai signatureImagePath aqui também
    const { specialtyIds, signatureImagePath, ...userData } = data;
    await prisma.user.findFirstOrThrow({ where: { id } });

    if (userData.commissionPlanId === "") userData.commissionPlanId = null;
    if (userData.professionalCouncilId === "")
      userData.professionalCouncilId = null;

    return prisma.user.update({
      where: { id },
      data: {
        ...userData,
        // Atualiza a assinatura se ela vier no payload
        signatureImagePath: signatureImagePath,
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
    await prisma.user.findFirstOrThrow({
      where: {
        id,
        clinicId,
      },
    });

    return prisma.user.delete({ where: { id } });
  }

  static async uploadSignature(file: MultipartFile, clinicId: string) {
    const fileExtension = file.filename.split(".").pop();
    const fileName = `${randomUUID()}.${fileExtension}`;
    // Organiza por clínica para não virar bagunça
    const filePath = `${clinicId}/professionals/${fileName}`;

    // Converte o stream para buffer para enviar ao Supabase
    const buffer = await file.toBuffer();

    const { data, error } = await supabase.storage
      .from(SIGNATURES_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      console.error("Erro upload assinatura:", error);
      throw new Error("Falha ao salvar assinatura no storage.");
    }

    return data.path; // Retorna o caminho para o frontend salvar no formulário
  }
}
