import { prisma } from "../lib/prisma";
import {
  CreatePatientInput,
  UpdatePatientInput,
} from "../schemas/patient.schema";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

export class PatientService {
  static async create(clinicId: string, data: CreatePatientInput) {
    const { address, phones, ...patientData } = data;

    return prisma.$transaction(async (tx) => {
      const newAddress = await tx.address.create({
        data: address,
      });

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

      await tx.phone.createMany({
        data: phones.map((phone) => ({
          ...phone,
          patientId: newPatient.id,
        })),
      });

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
      include: {
        address: true,
        phones: true,
        trafficSource: true,
        treatmentPlans: {
          orderBy: { createdAt: "desc" },
          include: {
            seller: { select: { fullName: true } },
            procedures: {
              include: {
                procedure: { select: { name: true } },
              },
            },
          },
        },
        appointments: {
          orderBy: { date: "desc" },
          include: {
            appointmentType: { select: { name: true } },
            professional: { select: { fullName: true } },
          },
        },
        assessments: {
          orderBy: { createdAt: "desc" },
          include: {
            template: { select: { name: true } },
            appointment: {
              select: {
                id: true,
                date: true,
                appointmentType: { select: { name: true } },
                professional: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
  }

  static async update(id: string, clinicId: string, data: UpdatePatientInput) {
    const { address, phones, ...patientData } = data;

    const existingPatient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
      select: { addressId: true },
    });

    return prisma.$transaction(async (tx) => {
      if (address && existingPatient.addressId) {
        await tx.address.update({
          where: { id: existingPatient.addressId },
          data: address,
        });
      }

      if (phones) {
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
    const patient = await prisma.patient.findFirstOrThrow({
      where: { id, clinicId },
      select: { addressId: true },
    });

    return prisma.$transaction(async (tx) => {
      await tx.patient.delete({ where: { id } });

      if (patient.addressId) {
        await tx.address.delete({ where: { id: patient.addressId } });
      }
    });
  }

  static async importPatients(fileBuffer: Buffer, clinicId: string) {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Converte para JSON
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name =
        row["Nome"] || row["Paciente"] || row["nome"] || row["paciente"];
      const rawCpf = row["CPF"] || row["cpf"] || "";
      const rawPhone =
        row["Telefone"] ||
        row["telefone"] ||
        row["Celular"] ||
        row["celular"] ||
        "";

      if (!name) {
        results.errors.push(`Linha ${rowNum}: Nome é obrigatório.`);
        continue;
      }

      // Tratamento de CPF
      const cpf = rawCpf.toString().replace(/\D/g, "");

      if (cpf.length !== 11) {
        results.errors.push(
          `Linha ${rowNum}: CPF inválido ou vazio (${name}).`
        );
        continue;
      }

      // Verifica duplicidade
      const existing = await prisma.patient.findFirst({
        where: { cpf, clinicId },
      });

      if (existing) {
        results.errors.push(`Linha ${rowNum}: CPF já cadastrado (${name}).`);
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Cria Paciente (sem endereço, pois não vem na planilha simples)
          const newPatient = await tx.patient.create({
            data: {
              name,
              cpf,
              birthDate: new Date(), // Fallback: define hoje ou deixe null se seu schema permitir (seu schema exige DateTime)
              // Se birthDate for obrigatório e não vier na planilha, definimos uma data padrão ou 01/01/1900
              // Idealmente a planilha deveria ter "Data de Nascimento"
              clinicId,
            },
          });

          // Cria Telefone se existir
          if (rawPhone) {
            const phoneClean = rawPhone.toString().replace(/\D/g, "");
            await tx.phone.create({
              data: {
                number: phoneClean,
                isWhatsapp: true, // Assume true por padrão na importação
                patientId: newPatient.id,
              },
            });
          }
        });
        results.success++;
      } catch (error) {
        console.error(error);
        results.errors.push(`Linha ${rowNum}: Erro ao salvar no banco.`);
      }
    }

    return results;
  }
}
