import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createReportSchema,
  updateReportSchema,
} from "../schemas/medicalReport.schema";
import PdfService from "./pdf.service";

export class MedicalReportService {
  static async create(data: z.infer<typeof createReportSchema>) {
    return prisma.medicalReport.create({
      data,
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findByPatientId(patientId: string) {
    return prisma.medicalReport.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      include: {
        professional: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }

  static async findById(reportId: string) {
    return prisma.medicalReport.findUniqueOrThrow({
      where: { id: reportId },
    });
  }

  static async update(
    reportId: string,
    data: z.infer<typeof updateReportSchema>
  ) {
    return prisma.medicalReport.update({
      where: { id: reportId },
      data,
    });
  }

  static async delete(reportId: string) {
    return prisma.medicalReport.delete({
      where: { id: reportId },
    });
  }

  static async generatePdf(
    reportId: string,
    clinicId: string
  ): Promise<Buffer> {
    const report = await this.findById(reportId);
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      include: { address: true },
    });

    const pdfBuffer = await this._generatePDFFromHTML(
      report.content,
      clinic,
      "Laudo Médico"
    );

    return pdfBuffer;
  }

  private static async _generatePDFFromHTML(
    content: string,
    clinic: any,
    documentTitle: string
  ): Promise<Buffer> {
    const headerTemplate = `
    <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
      <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
      ${
        clinic.address
          ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>`
          : ""
      }
      <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
    </div>
  `;

    const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${documentTitle}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 2cm 1.5cm;
            font-size: 12px;
            line-height: 1.6;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;

    const pdfBuffer = await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `,
      margin: { top: "120px", bottom: "60px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }
}
