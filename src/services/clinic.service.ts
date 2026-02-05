import { startOfDay } from "date-fns";
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
    // 1. Busca a clínica atual para comparar e validar segurança
    const clinic = await prisma.clinic.findFirst({
      where: {
        id,
        account: { ownerId },
      },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada ou acesso negado.");
    }

    // 2. Validação de CNPJ (Mantida)
    if (data.taxId && data.taxId !== clinic.taxId) {
      const taxIdExists = await prisma.clinic.findUnique({
        where: { taxId: data.taxId },
      });
      if (taxIdExists) {
        throw new Error("Este CNPJ já está em uso por outra clínica.");
      }
    }

    // 3. --- NOVA VERIFICAÇÃO DE HORÁRIO ---
    // Se o usuário está tentando mudar os horários...
    const newOpening = data.openingHour || clinic.openingHour;
    const newClosing = data.closingHour || clinic.closingHour;

    // Só verificamos se houve mudança real
    if (
      newOpening !== clinic.openingHour ||
      newClosing !== clinic.closingHour
    ) {
      // Busca agendamentos de HOJE para frente que conflitem
      const today = startOfDay(new Date());

      const conflicts = await prisma.appointment.findMany({
        where: {
          professional: {
            // Verifica agendamentos de profissionais desta clínica
            clinics: { some: { id } },
          },
          // Garante que o agendamento é desta clínica (via relação do paciente ou professional)
          // Melhor abordagem: filtrar por patient.clinicId se seu schema permitir, ou via professional
          // Assumindo relação direta ou filtro via contexto.
          // O mais seguro no seu schema atual (Patient -> Clinic) é:
          patient: { clinicId: id },

          date: { gte: today }, // Apenas datas futuras ou hoje
          status: { not: "CANCELED" }, // Ignora cancelados
          OR: [
            { startTime: { lt: newOpening } }, // Começa ANTES de abrir
            { endTime: { gt: newClosing } }, // Termina DEPOIS de fechar
          ],
        },
        include: {
          patient: { select: { name: true } },
          professional: { select: { fullName: true } },
        },
        orderBy: { date: "asc" },
      });

      if (conflicts.length > 0) {
        // LANÇA UM ERRO CUSTOMIZADO COM OS DADOS
        throw {
          isConflictError: true,
          message:
            "Existem agendamentos fora do novo horário de funcionamento.",
          conflicts: conflicts.map((appt) => ({
            id: appt.id,
            patientName: appt.patient.name,
            professionalName: appt.professional.fullName,
            date: appt.date,
            startTime: appt.startTime,
            endTime: appt.endTime,
          })),
        };
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
