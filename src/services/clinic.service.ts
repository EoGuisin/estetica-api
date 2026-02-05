import { prisma } from "../lib/prisma";

export class ClinicService {
  static async create(
    ownerId: string,
    data: {
      name: string;
      taxId: string;
      allowParallelAppointments: boolean;
      parallelAppointmentsLimit: number;
    }
  ) {
    // 1. Verifica se já existe clínica com este CNPJ/TaxID (Regra Global)
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
        allowParallelAppointments: data.allowParallelAppointments,
        parallelAppointmentsLimit: data.parallelAppointmentsLimit,
        status: "ACTIVE",
        accountId: account.id,
        // MELHORIA: Conecta o dono imediatamente à lista de usuários da clínica
        // Isso popula a tabela de relação _UserClinics
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
        account: { ownerId }, // <--- Trava de segurança
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
        status: data.status, // ACTIVE, INACTIVE, etc.
        allowParallelAppointments: data.allowParallelAppointments,
        parallelAppointmentsLimit: data.parallelAppointmentsLimit,
      },
    });
  }

  static async delete(id: string, ownerId: string) {
    // SEGURANÇA: Verifica propriedade
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId },
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    // Nota: O delete pode falhar se o banco não tiver CASCADE configurado
    // nas relações (pacientes, agendamentos, etc).
    // Idealmente, deve-se inativar a clínica em vez de deletar.
    return prisma.clinic.delete({
      where: { id },
    });
  }
}
