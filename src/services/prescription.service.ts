import { prisma } from "../lib/prisma";
import { z } from "zod";
import {
  createPrescriptionSchema,
  updatePrescriptionSchema,
} from "../schemas/prescription.schema";
import PdfService from "./pdf.service";

export class PrescriptionService {
  static async create(data: z.infer<typeof createPrescriptionSchema>) {
    return prisma.prescription.create({
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
    return prisma.prescription.findMany({
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

  static async findById(prescriptionId: string) {
    return prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
    });
  }

  static async update(
    prescriptionId: string,
    data: z.infer<typeof updatePrescriptionSchema>,
  ) {
    return prisma.prescription.update({
      where: { id: prescriptionId },
      data,
    });
  }

  static async delete(prescriptionId: string) {
    return prisma.prescription.delete({
      where: { id: prescriptionId },
    });
  }

  static async generatePdf(
    prescriptionId: string,
    clinicId: string,
  ): Promise<Buffer> {
    // 1. Buscamos a prescrição incluindo os dados do profissional e seu conselho
    const prescription = await prisma.prescription.findUniqueOrThrow({
      where: { id: prescriptionId },
      include: {
        professional: {
          include: {
            ProfessionalCouncil: true, // Inclui o nome do conselho (CRM, CRO, etc)
          },
        },
      },
    });

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      include: { address: true },
    });

    // 2. Passamos o objeto do profissional para o gerador de HTML
    const pdfBuffer = await this._generatePDFFromHTML(
      prescription.content,
      clinic,
      prescription.professional, // Passando o profissional aqui
    );

    return pdfBuffer;
  }

  private static async _generatePDFFromHTML(
    content: string,
    clinic: any,
    professional: any,
  ): Promise<Buffer> {
    const headerTemplate = `
      <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
        <h1 style="margin: 0; font-size: 14px;">${clinic.name}</h1>
        ${clinic.address ? `<p style="margin: 2px 0;">${clinic.address.street}, ${clinic.address.number} - ${clinic.address.city}/${clinic.address.state}</p>` : ""}
        <p style="margin: 2px 0;">CNPJ: ${clinic.taxId}</p>
      </div>
    `;

    // Bloco de assinatura com os novos dados solicitados
    const signatureBlock = `
      <div style="text-align: center; font-family: Arial, sans-serif; margin-top: 25px;">
        <div style="width: 350px; margin: 0 auto; border-top: 1px solid #000; padding-top: 8px;">
          <p style="margin: 0; font-size: 13px; font-weight: bold;">${professional.fullName}</p>
          <p style="margin: 2px 0; font-size: 11px; color: #333;">${clinic.name}</p>
          <p style="margin: 0; font-size: 11px; color: #555;">
            ${professional.ProfessionalCouncil?.name || "Conselho"}: ${professional.professionalCouncilRegistry || "N/A"}
          </p>
        </div>
      </div>
    `;

    const fullHtml = `
    <!DOCTYPE html>
    <html style="height: 100%;">
      <head>
        <meta charset="UTF-8">
        <style>
          html {
            height: 100%;
          }

          body {
            margin: 0;
            padding: 0.5cm 1.5cm;
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #333;
            min-height: calc(100vh - 50px);
            display: flex;
            flex-direction: column;
          }

          .content-area {
            flex: 1 1 auto;
          }

          .signature-area {
            margin-top: auto;
            padding-top: 20px;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="content-area">
          ${content}
        </div>
        <div class="signature-area">
          ${signatureBlock}
        </div>
      </body>
    </html>
    `;

    return await PdfService.generatePdfFromHtml(fullHtml, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: `
        <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: center; width: 100%;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
      // Ajuste das margens para o Puppeteer não cortar o conteúdo
      margin: { top: "120px", bottom: "50px", left: "20px", right: "20px" },
    });
  }
}
