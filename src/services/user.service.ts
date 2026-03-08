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
        openingHour: true,
        closingHour: true,
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

    if (data.scheduleStartHour && data.scheduleEndHour) {
      if (
        data.scheduleStartHour < clinic.openingHour ||
        data.scheduleEndHour > clinic.closingHour
      ) {
        throw new Error(
          `O horário de trabalho do profissional não pode exceder o funcionamento da clínica (${clinic.openingHour} às ${clinic.closingHour}).`
        );
      }
    }

    const {
      specialtyIds,
      password,
      signatureImagePath,
      clinicIds,
      ...userData
    } = data;

    const targetClinicIds = clinicIds ? Array.from(new Set(clinicIds)) : [];

    // Validação de segurança opcional: impedir criar usuário sem nenhuma clínica
    if (targetClinicIds.length === 0) {
      throw new Error(
        "É necessário vincular o usuário a pelo menos uma clínica."
      );
    }

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
          connect: targetClinicIds.map((id: any) => ({ id: String(id) })),
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
      OR: [
        { clinics: { some: { id: clinicId } } }, // Usuários vinculados a ESTA clínica
        { id: ownerId }, // Ou o dono da conta
      ],
      AND: [],
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

  static async update(id: string, clinicId: string, data: any) {
    // --- CORREÇÃO 2: Extrair clinicIds do payload ---
    const { specialtyIds, signatureImagePath, clinicIds, ...userData } = data;
    await prisma.user.findFirstOrThrow({ where: { id } });

    if (userData.scheduleStartHour || userData.scheduleEndHour) {
      const clinic = await prisma.clinic.findUniqueOrThrow({
        where: { id: clinicId },
        select: {
          openingHour: true,
          closingHour: true,
        },
      });

      // Valida Início (se foi enviado)
      if (
        userData.scheduleStartHour &&
        userData.scheduleStartHour < clinic.openingHour
      ) {
        throw new Error(
          `O horário de início (${userData.scheduleStartHour}) não pode ser anterior à abertura da clínica (${clinic.openingHour}).`
        );
      }

      // Valida Fim (se foi enviado)
      if (
        userData.scheduleEndHour &&
        userData.scheduleEndHour > clinic.closingHour
      ) {
        throw new Error(
          `O horário de fim (${userData.scheduleEndHour}) não pode ser posterior ao fechamento da clínica (${clinic.closingHour}).`
        );
      }
    }

    if (userData.commissionPlanId === "") userData.commissionPlanId = null;
    if (userData.professionalCouncilId === "")
      userData.professionalCouncilId = null;

    return prisma.user.update({
      where: { id },
      data: {
        ...userData,
        signatureImagePath: signatureImagePath,
        // Atualiza as relações N:N com base no que veio do front
        clinics:
          clinicIds === undefined
            ? undefined
            : {
                set: clinicIds.map((cid: string) => ({ id: cid })),
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
