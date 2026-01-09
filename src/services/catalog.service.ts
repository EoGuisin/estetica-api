import { prisma } from "../lib/prisma";
import * as XLSX from "xlsx";

type CatalogModel =
  | "specialty"
  | "appointmentType"
  | "trafficSource"
  | "procedure"
  | "role";

export class CatalogService {
  // Busca item garantindo que pertence à clínica
  static async getById(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    return prisma[model].findFirst({
      where: {
        id,
        clinicId,
      },
    });
  }

  // Lista APENAS itens da clínica
  static async list(model: CatalogModel, clinicId: string) {
    // @ts-ignore
    return prisma[model].findMany({
      where: {
        clinicId: clinicId,
      },
      orderBy: { name: "asc" },
    });
  }

  static async create(
    model: CatalogModel,
    data: { name: string },
    clinicId: string
  ) {
    // @ts-ignore
    return prisma[model].create({
      data: { ...data, clinicId },
    });
  }

  static async update(
    model: CatalogModel,
    id: string,
    data: { name: string },
    clinicId: string
  ) {
    // @ts-ignore
    await prisma[model].findFirstOrThrow({ where: { id, clinicId } });
    // @ts-ignore
    return prisma[model].update({ where: { id }, data });
  }

  static async delete(model: CatalogModel, id: string, clinicId: string) {
    // @ts-ignore
    await prisma[model].findFirstOrThrow({ where: { id, clinicId } });
    // @ts-ignore
    return prisma[model].delete({ where: { id } });
  }

  static async listProcedures(clinicId: string) {
    return prisma.procedure.findMany({
      where: {
        clinicId, // <--- Apenas desta clínica
      },
      include: { specialty: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  static async createProcedure(data: any, clinicId: string) {
    return prisma.procedure.create({
      data: { ...data, clinicId },
    });
  }

  static async updateProcedure(id: string, data: any, clinicId: string) {
    await prisma.procedure.findFirstOrThrow({ where: { id, clinicId } });
    return prisma.procedure.update({ where: { id }, data });
  }

  static async importProcedures(fileBuffer: Buffer, clinicId: string) {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Converte para JSON
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
    });

    const results = {
      total: rows.length,
      success: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      // CRIA UM NOVO OBJETO COM AS CHAVES LIMPAS (SEM ESPAÇOS)
      const cleanRow: any = {};
      Object.keys(row).forEach((key) => {
        cleanRow[key.trim()] = row[key];
      });

      // AGORA BUSCA NAS CHAVES LIMPAS
      const name =
        cleanRow["Nome"] || cleanRow["nome"] || cleanRow["Procedimento"];
      const specialtyName =
        cleanRow["Especialidade"] ||
        cleanRow["especialidade"] ||
        cleanRow["Categoria"];
      const priceRaw =
        cleanRow["Preço"] || cleanRow["Valor"] || cleanRow["Preco"] || "0";

      if (!name || !specialtyName) {
        // Log para você debugar se necessário
        console.log(`Erro na linha ${rowNum}:`, cleanRow);
        results.errors.push(
          `Linha ${rowNum}: Nome e Especialidade são obrigatórios.`
        );
        continue;
      }

      let standardPrice = 0;

      let raw = priceRaw?.toString().trim() ?? "0";
      raw = raw.replace(/^R\$\s?/, "");

      if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(raw)) {
        raw = raw.replace(/\./g, "").replace(",", ".");
        standardPrice = Number(raw);
      } else if (/^\d+,\d{2}$/.test(raw)) {
        raw = raw.replace(",", ".");
        standardPrice = Number(raw);
      } else if (/^\d+(\.\d+)?$/.test(raw)) {
        standardPrice = Number(raw);
      }

      if (isNaN(standardPrice)) standardPrice = 0;

      try {
        await prisma.$transaction(async (tx) => {
          // 1. Busca ou Cria Especialidade
          let specialty = await tx.specialty.findFirst({
            where: {
              name: { equals: specialtyName, mode: "insensitive" },
              clinicId: clinicId,
            },
          });

          if (!specialty) {
            specialty = await tx.specialty.create({
              data: {
                name: specialtyName,
                clinicId: clinicId,
              },
            });
          }

          // 2. Cria ou Atualiza Procedimento
          const existingProc = await tx.procedure.findFirst({
            where: {
              name: { equals: name, mode: "insensitive" },
              clinicId: clinicId,
            },
          });

          if (!existingProc) {
            await tx.procedure.create({
              data: {
                name,
                standardPrice,
                specialtyId: specialty.id,
                clinicId,
              },
            });
            results.success++;
          } else {
            // Opcional: Atualizar preço se já existir? Por segurança, apenas avisamos.
            results.errors.push(
              `Linha ${rowNum}: Procedimento "${name}" já existe.`
            );
          }
        });
      } catch (error) {
        console.error(error);
        results.errors.push(`Linha ${rowNum}: Erro ao salvar "${name}".`);
      }
    }

    return results;
  }
}
