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
          maritalStatus: patientData.maritalStatus,
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
    document?: string,
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
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const results = { total: rows.length, success: 0, errors: [] as string[] };

    // 1. Limpeza inicial e extração de CPFs para validação em massa
    const validRows = rows
      .map((row, index) => {
        const name =
          row["Nome"] || row["Paciente"] || row["nome"] || row["paciente"];
        const rawCpf = row["CPF"] || row["cpf"] || "";
        const cpf = rawCpf.toString().replace(/\D/g, "");
        const phone = (row["Telefone"] || row["telefone"] || "")
          .toString()
          .replace(/\D/g, "");

        return { name, cpf, phone, rowNum: index + 2 };
      })
      .filter((r) => {
        if (!r.name || r.cpf.length !== 11) {
          results.errors.push(
            `Linha ${r.rowNum}: Dados inválidos (Nome ou CPF).`,
          );
          return false;
        }
        return true;
      });

    // 2. Busca todos os CPFs que já existem de uma vez só (Performance O(1))
    const allCpfs = validRows.map((r) => r.cpf);
    const existingPatients = await prisma.patient.findMany({
      where: { clinicId, cpf: { in: allCpfs } },
      select: { cpf: true },
    });
    const existingCpfSet = new Set(existingPatients.map((p) => p.cpf));

    // 3. Processa em blocos para não sobrecarregar o banco
    const toImport = validRows.filter((r) => {
      if (existingCpfSet.has(r.cpf)) {
        results.errors.push(`Linha ${r.rowNum}: CPF ${r.cpf} já cadastrado.`);
        return false;
      }
      return true;
    });

    // Usamos uma transação única para o lote ou dividimos em pedaços de 100
    // Para manter a relação de Telefone, vamos iterar, mas sem o findFirst individual
    for (const data of toImport) {
      try {
        await prisma.$transaction(async (tx) => {
          const newPatient = await tx.patient.create({
            data: {
              name: data.name,
              cpf: data.cpf,
              birthDate: new Date(1900, 0, 1), // Melhor usar um fallback fixo
              clinicId,
            },
          });

          if (data.phone) {
            await tx.phone.create({
              data: {
                number: data.phone,
                isWhatsapp: true,
                patientId: newPatient.id,
              },
            });
          }
        });
        results.success++;
      } catch (error) {
        results.errors.push(`Linha ${data.rowNum}: Erro ao salvar.`);
      }
    }

    return results;
  }
}
