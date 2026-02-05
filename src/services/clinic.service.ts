import { prisma } from "../lib/prisma";

export class ClinicService {
  static async getById(clinicId: string) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        taxId: true,
        status: true,
        openingHour: true,
        closingHour: true,
        allowParallelAppointments: true,
        parallelAppointmentsLimit: true,
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada.");
    }

    return clinic;
  }

  static async create(
    ownerId: string,
    data: {
      name: string;
      taxId: string;
      allowParallelAppointments?: boolean;
      parallelAppointmentsLimit?: number;
      openingHour?: string;
      closingHour?: string;
    }
  ) {
    // 1. Verifica se já existe clínica com este CNPJ/TaxID
    const existingClinic = await prisma.clinic.findUnique({
      where: { taxId: data.taxId },
    });

    if (existingClinic) {
      throw new Error("Uma clínica com este CNPJ já está cadastrada.");
    }

    // 2. Encontra a Conta do usuário
    const account = await prisma.account.findUnique({
      where: { ownerId },
    });

    if (!account) {
      throw new Error(
        "Conta principal não encontrada. Apenas proprietários podem criar clínicas."
      );
    }

    // 3. Cria a clínica
    return prisma.clinic.create({
      data: {
        name: data.name,
        taxId: data.taxId,
        allowParallelAppointments: data.allowParallelAppointments ?? false,
        parallelAppointmentsLimit: data.parallelAppointmentsLimit ?? 1,
        openingHour: data.openingHour ?? "08:00",
        closingHour: data.closingHour ?? "18:00",
        status: "ACTIVE",
        accountId: account.id,
        users: {
          connect: { id: ownerId },
        },
      },
    });
  }

  static async update(id: string, ownerId: string, data: any) {
    // SEGURANÇA: Verifica se a clínica pertence à conta do usuário
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId },
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    // Se estiver tentando alterar o CNPJ, verificar duplicidade
    if (data.taxId && data.taxId !== clinic.taxId) {
      const taxIdExists = await prisma.clinic.findUnique({
        where: { taxId: data.taxId },
      });
      if (taxIdExists) {
        throw new Error("Este CNPJ já está em uso por outra clínica.");
      }
    }

    return prisma.clinic.update({
      where: { id },
      data: {
        name: data.name,
        taxId: data.taxId,
        status: data.status,
        allowParallelAppointments: data.allowParallelAppointments,
        parallelAppointmentsLimit: data.parallelAppointmentsLimit,
        openingHour: data.openingHour,
        closingHour: data.closingHour,
      },
    });
  }

  static async delete(id: string, ownerId: string) {
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId },
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    return prisma.clinic.delete({
      where: { id },
    });
  }
}
