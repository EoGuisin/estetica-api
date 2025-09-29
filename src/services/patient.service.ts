// src/services/patient.service.ts
import { prisma } from "../lib/prisma";
import {
  CreatePatientInput,
  UpdatePatientInput,
} from "../schemas/patient.schema";
import { Prisma } from "@prisma/client";

export class PatientService {
  static async create(clinicId: string, data: CreatePatientInput) {
    const { address, phones, ...patientData } = data;

    // Usamos uma transação para garantir a integridade dos dados
    return prisma.$transaction(async (tx) => {
      // 1. Criar o endereço primeiro
      const newAddress = await tx.address.create({
        data: address,
      });

      // 2. Criar o paciente, vinculando ao endereço criado
      const newPatient = await tx.patient.create({
        data: {
          ...patientData,
          birthDate: new Date(patientData.birthDate),
          guardianBirthDate: patientData.guardianBirthDate
            ? new Date(patientData.guardianBirthDate)
            : null,
          clinicId,
          addressId: newAddress.id,
        },
      });

      // 3. Criar os telefones, vinculando ao paciente criado
      await tx.phone.createMany({
        data: phones.map((phone) => ({
          ...phone,
          patientId: newPatient.id,
        })),
      });

      // Retornar o paciente completo com suas relações
      return newPatient;
    });
  }
  static async list(
    clinicId: string,
    page: number,
    pageSize: number,
    name?: string,
    document?: string
  ) {
    const where: Prisma.PatientWhereInput = { clinicId };

    if (name) {
      where.name = { contains: name, mode: "insensitive" };
    }
    if (document) {
      where.OR = [
        { cpf: { contains: document } },
        { identityCard: { contains: document } },
      ];
    }

    const skip = (page - 1) * pageSize;

    // Usamos transação para pegar os dados e o total na mesma chamada
    const [patients, totalCount] = await prisma.$transaction([
      prisma.patient.findMany({
        where,
        include: {
          clinic: { select: { name: true } },
          phones: { take: 1 },
        },
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.patient.count({ where }),
    ]);

    return { patients, totalCount };
  }

  static async getById(id: string, clinicId: string) {
    return prisma.patient.findFirst({
      where: { id, clinicId },
      include: { address: true, phones: true },
    });
  }

  static async update(id: string, clinicId: string, data: UpdatePatientInput) {
    const { address, phones, ...patientData } = data;

    // Garante que o paciente a ser atualizado pertence à clínica
    const existingPatient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
    });

    return prisma.$transaction(async (tx) => {
      if (address) {
        await tx.address.update({
          where: { id: existingPatient.addressId! },
          data: address,
        });
      }

      if (phones) {
        // Deleta os telefones antigos e cria os novos
        await tx.phone.deleteMany({ where: { patientId: id } });
        await tx.phone.createMany({
          data: phones.map((phone) => ({ ...phone, patientId: id })),
        });
      }

      const updatedPatient = await tx.patient.update({
        where: { id },
        data: {
          ...patientData,
          birthDate: patientData.birthDate
            ? new Date(patientData.birthDate)
            : undefined,
          guardianBirthDate: patientData.guardianBirthDate
            ? new Date(patientData.guardianBirthDate)
            : undefined,
        },
      });
      return updatedPatient;
    });
  }

  static async delete(id: string, clinicId: string) {
    // Garante que o paciente a ser deletado pertence à clínica
    const patient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
      select: { addressId: true },
    });

    return prisma.$transaction(async (tx) => {
      // Deleta o paciente (e os telefones em cascata)
      await tx.patient.delete({ where: { id } });
      // Deleta o endereço associado
      if (patient.addressId) {
        await tx.address.delete({ where: { id: patient.addressId } });
      }
    });
  }
}
