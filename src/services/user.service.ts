import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { supabase } from "../lib/supabase";
import { MultipartFile } from "@fastify/multipart";

const SIGNATURES_BUCKET = "signatures";

export class UserService {
  static async create(currentClinicId: string, data: any) {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: currentClinicId },
      select: {
        account: {
          select: {
            subscription: {
              select: { currentMaxUsers: true, status: true },
            },
          },
        },
      },
    });

    const sub = clinic.account?.subscription;

    if (!sub || (sub.status !== "active" && sub.status !== "trialing")) {
      throw new Error("Sua assinatura não está ativa. Verifique o pagamento.");
    }

    // --- CORREÇÃO 1: Contagem baseada na relação N:N ---
    const currentUsers = await prisma.user.count({
      where: {
        clinics: {
          some: { id: currentClinicId }, // Usa 'currentClinicId' que veio no parametro
        },
      },
    });

    if (currentUsers >= sub.currentMaxUsers) {
      throw new Error(
        `Limite de usuários atingido (${sub.currentMaxUsers}). Faça um upgrade ou compre usuários adicionais.`
      );
    }

    const {
      specialtyIds,
      password,
      signatureImagePath,
      clinicIds, // Certifique-se que o frontend manda isso
      ...userData
    } = data;
    const passwordHash = await bcrypt.hash(password, 10);

    const emailExists = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (emailExists) {
      throw new Error("Este e-mail já está em uso por outro usuário.");
    }

    return prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        clinics: {
          // Conecta as clínicas selecionadas + a clínica atual (opcional, mas recomendado para garantir acesso onde foi criado)
          connect: clinicIds.map((id: string) => ({ id })),
        },
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
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { account: { select: { ownerId: true } } },
    });

    const ownerId = clinic?.account?.ownerId;

    const where: Prisma.UserWhereInput = {
      clinics: {
        some: { id: clinicId },
      },
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
        role: true,
        clinics: { select: { id: true, name: true } },
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
    // --- CORREÇÃO 2: Extrair clinicIds do payload ---
    const { specialtyIds, signatureImagePath, clinicIds, ...userData } = data;
    await prisma.user.findFirstOrThrow({ where: { id } });

    if (userData.commissionPlanId === "") userData.commissionPlanId = null;
    if (userData.professionalCouncilId === "")
      userData.professionalCouncilId = null;

    return prisma.user.update({
      where: { id },
      data: {
        ...userData,
        signatureImagePath: signatureImagePath,
        // Atualiza as relações N:N
        clinics:
          clinicIds === undefined
            ? undefined
            : {
                set: clinicIds.map((cid: string) => ({ id: cid })), // Substitui todas as clínicas pelas novas
              },
        specialties:
          specialtyIds === undefined
            ? undefined
            : {
                set: specialtyIds?.map((sid: string) => ({ id: sid })) || [],
              },
      },
    });
  }

  static async delete(id: string, clinicId: string) {
    // --- CORREÇÃO 3: Verificar existência usando a relação ---
    await prisma.user.findFirstOrThrow({
      where: {
        id,
        clinics: {
          some: { id: clinicId },
        },
      },
    });

    return prisma.user.delete({ where: { id } });
  }

  static async uploadSignature(file: MultipartFile, clinicId: string) {
    const fileExtension = file.filename.split(".").pop();
    const fileName = `${randomUUID()}.${fileExtension}`;
    const filePath = `${clinicId}/professionals/${fileName}`;

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

    return data.path;
  }
}
