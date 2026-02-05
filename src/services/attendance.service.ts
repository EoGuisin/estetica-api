import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import { randomUUID } from "node:crypto";
import {
  saveAttachmentSchema,
  saveBeforeAfterSchema,
} from "../schemas/attendance.schema";
import { z } from "zod";
import { DocumentType } from "@prisma/client";
import { substituteVariables } from "../lib/templateVariables";
import PdfService from "./pdf.service";

const ATTACHMENTS_BUCKET = "attachments";
const BEFORE_AFTER_BUCKET = "before-after";
const DOCUMENTS_BUCKET = "documents";
const SIGNATURES_BUCKET = "signatures";

export class AttendanceService {
  static async checkStorageLimit(clinicId: string, newFileSize: number) {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        storageUsed: true,
        account: {
          select: {
            subscription: {
              select: { currentMaxStorage: true, status: true },
            },
          },
        },
      },
    });

    const subscription = clinic.account.subscription;

    if (!subscription || subscription.status !== "active") {
      throw new Error("Assinatura inativa ou inexistente.");
    }

    const currentUsed = clinic.storageUsed;
    const sizeToAdd = BigInt(newFileSize);
    const limit = subscription.currentMaxStorage;

    if (currentUsed + sizeToAdd > limit) {
      throw new Error(
        "Limite de armazenamento excedido (10GB). Faça um upgrade para continuar enviando arquivos."
      );
    }

    return true;
  }

  static async getTemplatesForPatient(
    patientId: string,
    type: DocumentType,
    clinicIdFromRequest: string
  ): Promise<any[]> {
    // 1. SEGURANÇA: Busca o paciente e garante que ele é da clínica solicitada
    const patient = await prisma.patient.findFirstOrThrow({
      where: {
        id: patientId,
        clinicId: clinicIdFromRequest, // <--- TRAVA DE SEGURANÇA
      },
      include: {
        treatmentPlans: {
          include: {
            procedures: {
              include: {
                procedure: true,
              },
            },
          },
          where: { clinicId: clinicIdFromRequest },
        },
      },
    });

    const targetClinicId = clinicIdFromRequest;

    const specialtyIds = new Set<string>();

    patient.treatmentPlans.forEach((plan) => {
      plan.procedures.forEach((proc) => {
        if (proc.procedure?.specialtyId) {
          specialtyIds.add(proc.procedure.specialtyId);
        }
      });
    });

    if (specialtyIds.size === 0) {
      return [];
    }

    const templates = await prisma.specialtyTemplate.findMany({
      where: {
        clinicId: targetClinicId,
        type: type,
        isActive: true,
        specialtyId: {
          in: Array.from(specialtyIds),
        },
      },
      include: {
        specialty: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    return templates;
  }

  static async generateDocumentFromTemplate(data: {
    patientId: string;
    templateId: string;
    clinicId: string;
    professionalId: string;
  }) {
    if (!data.professionalId) {
      throw new Error("ID do profissional é obrigatório.");
    }

    // 1. Template deve ser da clínica
    const template = await prisma.specialtyTemplate.findFirstOrThrow({
      where: {
        id: data.templateId,
        clinicId: data.clinicId, // SEGURANÇA
      },
      include: { specialty: true },
    });

    // 2. Paciente deve ser da clínica
    const patient = await prisma.patient.findFirstOrThrow({
      where: {
        id: data.patientId,
        clinicId: data.clinicId, // SEGURANÇA
      },
      include: {
        address: true,
        phones: true,
        treatmentPlans: {
          include: {
            procedures: {
              include: { procedure: { include: { specialty: true } } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: data.clinicId },
      include: { address: true },
    });

    // Busca o profissional selecionado (deve ter vínculo com a clínica, idealmente, mas o template já filtra)
    const professional = await prisma.user.findUnique({
      where: { id: data.professionalId },
      select: { signatureImagePath: true, fullName: true },
    });

    let professionalSignatureUrl = null;
    if (professional?.signatureImagePath) {
      const { data: signData } = await supabase.storage
        .from(SIGNATURES_BUCKET)
        .createSignedUrl(professional.signatureImagePath, 60 * 10);
      professionalSignatureUrl = signData?.signedUrl;
    }

    let treatmentPlanData = null;
    if (patient.treatmentPlans.length > 0) {
      const plan = patient.treatmentPlans[0];
      const firstProcedure = plan.procedures[0];

      treatmentPlanData = {
        specialty: firstProcedure?.procedure?.specialty?.name,
        procedure: firstProcedure?.procedure?.name,
        procedures: plan.procedures,
        sessions: firstProcedure?.contractedSessions,
        total: plan.total,
      };
    }

    const filledContent = substituteVariables(template.content, {
      patient,
      clinic,
      treatmentPlan: treatmentPlanData,
      professionalSignatureUrl,
      patientSignatureUrl: null,
    });

    const timestamp = Date.now();
    const fileName = `${template.type.toLowerCase()}_${patient.name.replace(
      / /g,
      "_"
    )}_${timestamp}.pdf`;
    const filePath = `${data.clinicId}/${data.patientId}/${fileName}`;

    const pdfBuffer = await this.generatePDFFromHTML(
      filledContent,
      clinic,
      template.name
    );

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, pdfBuffer, { contentType: "application/pdf" });

    if (uploadError) throw new Error("Erro ao fazer upload do PDF.");

    const document = await prisma.patientDocument.create({
      data: {
        patientId: data.patientId,
        templateId: data.templateId,
        professionalId: data.professionalId,
        fileName,
        filePath,
        fileType: "application/pdf",
        size: pdfBuffer.length,
        type: template.type,
        status: "PENDING",
      },
    });

    return document;
  }

  static async signDocument(
    data: {
      documentId: string;
      signatureBase64: string;
    },
    clinicId: string // ADICIONADO
  ) {
    // 1. Busca documento e valida acesso da clínica
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: data.documentId,
        patient: { clinicId: clinicId }, // SEGURANÇA
      },
      include: {
        patient: {
          include: {
            address: true,
            phones: true,
            treatmentPlans: {
              include: {
                procedures: {
                  include: { procedure: { include: { specialty: true } } },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            appointments: {
              orderBy: { date: "desc" },
              take: 1,
              select: { professionalId: true },
            },
          },
        },
        template: true,
      },
    });

    if (document.status === "SIGNED") {
      throw new Error("Este documento já foi assinado e finalizado.");
    }

    if (!document.template) {
      throw new Error(
        "Documento sem template não pode ser assinado digitalmente."
      );
    }

    const signatureBuffer = Buffer.from(
      data.signatureBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const patientSignaturePath = `${clinicId}/${document.patientId}/signatures/${document.id}_patient.png`;

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(patientSignaturePath, signatureBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) throw new Error("Erro ao salvar assinatura do paciente.");

    const { data: patSignData } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(patientSignaturePath, 120);

    let professionalSignatureUrl = null;
    let professionalId = null;

    if (document.professionalId) {
      professionalId = document.professionalId;
    } else {
      const plan = document.patient.treatmentPlans[0];
      if (plan && plan.sellerId) professionalId = plan.sellerId;
      else if (document.patient.appointments.length > 0)
        professionalId = document.patient.appointments[0].professionalId;
    }

    if (professionalId) {
      const professional = await prisma.user.findUnique({
        where: { id: professionalId },
        select: { signatureImagePath: true },
      });

      if (professional?.signatureImagePath) {
        const { data: profSignData } = await supabase.storage
          .from(SIGNATURES_BUCKET)
          .createSignedUrl(professional.signatureImagePath, 120);

        professionalSignatureUrl = profSignData?.signedUrl;
      }
    }

    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      include: { address: true },
    });

    let treatmentPlanData = null;
    const plan = document.patient.treatmentPlans[0];
    if (plan) {
      const proc = plan.procedures[0];
      treatmentPlanData = {
        specialty: proc?.procedure?.specialty?.name,
        procedure: proc?.procedure?.name,
        sessions: proc?.contractedSessions,
        total: plan.total,
      };
    }

    const filledContent = substituteVariables(document.template.content, {
      patient: document.patient,
      clinic,
      treatmentPlan: treatmentPlanData,
      professionalSignatureUrl,
      patientSignatureUrl: patSignData?.signedUrl,
    });

    const pdfBuffer = await this.generatePDFFromHTML(
      filledContent,
      clinic,
      document.fileName.replace(".pdf", "")
    );

    const { error: pdfUploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(document.filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (pdfUploadError) throw new Error("Erro ao atualizar o PDF assinado.");

    await prisma.patientDocument.update({
      where: { id: data.documentId },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        patientSignaturePath: patientSignaturePath,
        size: pdfBuffer.length,
      },
    });

    return { success: true };
  }

  private static async generatePDFFromHTML(
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

  static async getAttendanceData(appointmentId: string, clinicId: string) {
    const appointment = await prisma.appointment.findFirstOrThrow({
      where: {
        id: appointmentId,
        patient: { clinicId: clinicId }, // SEGURANÇA
      },
      include: {
        patient: true,
        professional: { select: { fullName: true } },
        treatmentPlan: {
          include: {
            procedures: {
              include: {
                procedure: {
                  include: {
                    specialty: true,
                  },
                },
              },
            },
          },
        },
        clinicalRecord: true,
      },
    });

    const assessments = await prisma.patientAssessment.findMany({
      where: {
        patientId: appointment.patient.id,
        clinicId: clinicId, // SEGURANÇA
      },
      include: {
        template: true,
        appointment: {
          include: {
            appointmentType: true,
          },
        },
        professional: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Histórico: busca agendamentos do paciente, mas como já validamos que o paciente é da clínica, está OK.
    // Mas para garantir:
    const patientHistory = await prisma.appointment.findMany({
      where: {
        patientId: appointment.patient.id,
        // (Opcional, mas redundante se o paciente já é da clínica)
      },
      include: {
        appointmentType: true,
        professional: true,
        assessment: { select: { id: true } },
        clinicalRecord: true,
      },
      orderBy: { date: "desc" },
    });

    const beforeAfterImages = await prisma.beforeAfterImage.findMany({
      where: { patientId: appointment.patient.id },
      orderBy: { createdAt: "desc" },
    });

    const imagesWithUrls = await Promise.all(
      beforeAfterImages.map(async (image) => {
        const { data: beforeData } = await supabase.storage
          .from(BEFORE_AFTER_BUCKET)
          .createSignedUrl(image.beforeImagePath, 60 * 5);

        let afterSignedUrl = null;
        if (image.afterImagePath) {
          const { data: afterData } = await supabase.storage
            .from(BEFORE_AFTER_BUCKET)
            .createSignedUrl(image.afterImagePath, 60 * 5);
          afterSignedUrl = afterData?.signedUrl ?? null;
        }

        return {
          ...image,
          beforeImagePath: beforeData?.signedUrl ?? "",
          afterImagePath: afterSignedUrl,
        };
      })
    );

    return {
      appointment: appointment,
      patient: {
        ...appointment.patient,
        beforeAfterImages: imagesWithUrls,
      },
      treatmentPlan: appointment.treatmentPlan,
      clinicalRecord: appointment.clinicalRecord,
      assessments,
      patientHistory,
    };
  }

  static async saveDiagnosis(
    appointmentId: string,
    diagnosis: string | null | undefined,
    clinicId: string // ADICIONADO
  ) {
    // 1. Verifica se o agendamento pertence a um paciente desta clínica
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patient: { clinicId: clinicId },
      },
    });

    if (!appointment) {
      throw new Error("Appointment not found or access denied.");
    }

    return prisma.clinicalRecord.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        diagnosis: diagnosis || "",
      },
      update: {
        diagnosis: diagnosis || "",
      },
    });
  }

  static async listAttachments(patientId: string, clinicId: string) {
    // SEGURANÇA: Verifica se o paciente pertence à clínica na query
    const attachments = await prisma.attachment.findMany({
      where: {
        patientId,
        patient: { clinicId: clinicId }, // <--- TRAVA
      },
      orderBy: { createdAt: "desc" },
    });

    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        let viewUrl: string | null = null;
        if (attachment.fileType.startsWith("image/")) {
          const { data } = await supabase.storage
            .from(ATTACHMENTS_BUCKET)
            .createSignedUrl(attachment.filePath, 60 * 5);
          viewUrl = data?.signedUrl ?? null;
        }
        return { ...attachment, viewUrl };
      })
    );
    return attachmentsWithUrls;
  }

  static async createSignedUploadUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
  }) {
    // Opcional: verificar se patientId pertence à clinicId aqui também, mas
    // o saveAttachment fará a verificação final.
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    const { data: signedUrlData, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error:", error);
      throw new Error("Could not create signed upload URL");
    }

    return { ...signedUrlData, filePath };
  }

  static async saveAttachment(
    data: z.infer<typeof saveAttachmentSchema>,
    clinicId: string // ADICIONADO
  ) {
    // 1. Busca a clínica e valida que o paciente pertence a ELA
    const clinic = await prisma.clinic.findFirstOrThrow({
      where: {
        id: clinicId, // A clínica do request
        patients: { some: { id: data.patientId } }, // O paciente deve estar nela
      },
    });

    await this.checkStorageLimit(clinic.id, data.size);

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        storageUsed: { increment: data.size },
      },
    });

    return prisma.attachment.create({
      data: {
        patientId: data.patientId,
        fileName: data.fileName,
        description: data.description,
        filePath: data.filePath,
        fileType: data.fileType,
        size: data.size,
      },
    });
  }

  static async deleteAttachment(attachmentId: string, clinicId: string) {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: {
        id: attachmentId,
        patient: { clinicId }, // SEGURANÇA
      },
    });

    const { error: storageError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([attachment.filePath]);

    if (storageError) {
      console.error("Supabase storage deletion error:", storageError.message);
    }

    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        storageUsed: { decrement: attachment.size },
      },
    });

    await prisma.attachment.delete({
      where: { id: attachmentId },
    });
  }

  static async getBeforeAfterImages(patientId: string, clinicId: string) {
    const images = await prisma.beforeAfterImage.findMany({
      where: {
        patientId,
        patient: { clinicId: clinicId }, // SEGURANÇA
      },
      orderBy: { createdAt: "desc" },
    });

    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        const { data: beforeData } = await supabase.storage
          .from(BEFORE_AFTER_BUCKET)
          .createSignedUrl(image.beforeImagePath, 60 * 5);

        let afterSignedUrl: string | null = null;
        if (image.afterImagePath) {
          const { data: afterData } = await supabase.storage
            .from(BEFORE_AFTER_BUCKET)
            .createSignedUrl(image.afterImagePath, 60 * 5);
          afterSignedUrl = afterData?.signedUrl ?? null;
        }

        return {
          ...image,
          beforeImageSignedUrl: beforeData?.signedUrl ?? null,
          afterImageSignedUrl: afterSignedUrl,
        };
      })
    );
    return imagesWithUrls;
  }

  static async getBeforeAfterDownloadUrl(
    imageId: string,
    type: "before" | "after",
    clinicId: string
  ) {
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: { id: imageId, patient: { clinicId } }, // SEGURANÇA
    });

    const filePath =
      type === "before" ? image.beforeImagePath : image.afterImagePath;

    if (!filePath) {
      throw new Error(`Image type '${type}' not found.`);
    }

    const { data, error } = await supabase.storage
      .from(BEFORE_AFTER_BUCKET)
      .createSignedUrl(filePath, 3600, {
        download: `${type}-${image.id}.jpg`,
      });

    if (error || !data) {
      throw new Error("Could not generate download URL");
    }
    return { signedUrl: data.signedUrl };
  }

  static async createBeforeAfterSignedUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
    imageType: "before" | "after";
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${data.imageType}-${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    const { data: signedUrlData, error } = await supabase.storage
      .from(BEFORE_AFTER_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error (before-after):", error);
      throw new Error(
        "Could not create signed upload URL for before/after image"
      );
    }

    return { ...signedUrlData, filePath };
  }

  static async saveBeforeAfterImage(
    data: z.infer<typeof saveBeforeAfterSchema>,
    clinicId: string // ADICIONADO
  ) {
    // Verifica se paciente pertence à clínica
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, clinicId: clinicId },
    });
    if (!patient) throw new Error("Paciente não encontrado ou acesso negado.");

    return prisma.beforeAfterImage.create({
      data: {
        patientId: data.patientId,
        treatmentPlanId: data.treatmentPlanId,
        description: data.description,
        beforeImagePath: data.beforeImagePath,
        afterImagePath: data.afterImagePath,
      },
    });
  }

  static async updateAfterImage(
    imageId: string,
    afterImagePath: string,
    clinicId: string // ADICIONADO
  ) {
    // Verifica propriedade
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: { id: imageId, patient: { clinicId } },
    });

    return prisma.beforeAfterImage.update({
      where: { id: imageId },
      data: { afterImagePath },
    });
  }

  static async deleteBeforeAfterImage(imageId: string, clinicId: string) {
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: {
        id: imageId,
        patient: { clinicId }, // SEGURANÇA
      },
    });

    const filesToRemove = [image.beforeImagePath];
    if (image.afterImagePath) {
      filesToRemove.push(image.afterImagePath);
    }

    await supabase.storage.from(BEFORE_AFTER_BUCKET).remove(filesToRemove);

    await prisma.beforeAfterImage.delete({
      where: { id: imageId },
    });
  }

  static async listDocuments(
    patientId: string,
    type: DocumentType,
    clinicId: string
  ) {
    const documents = await prisma.patientDocument.findMany({
      where: {
        patientId,
        type,
        patient: { clinicId: clinicId }, // SEGURANÇA
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return documents;
  }

  static async createDocumentSignedUrl(data: {
    fileName: string;
    fileType: string;
    patientId: string;
    clinicId: string;
    documentType: DocumentType;
  }) {
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${data.documentType.toLowerCase()}-${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    const { data: signedUrlData, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error (documents):", error);
      throw new Error("Could not create signed upload URL for document");
    }

    return { ...signedUrlData, filePath };
  }

  static async saveDocument(
    data: {
      patientId: string;
      fileName: string;
      description?: string | null;
      filePath: string;
      fileType: string;
      size: number;
      documentType: DocumentType;
    },
    clinicId: string // ADICIONADO
  ) {
    // Verifica paciente
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, clinicId: clinicId },
    });
    if (!patient) throw new Error("Paciente não encontrado ou acesso negado.");

    return prisma.patientDocument.create({
      data: {
        patientId: data.patientId,
        fileName: data.fileName,
        description: data.description,
        filePath: data.filePath,
        fileType: data.fileType,
        size: data.size,
        type: data.documentType,
        status: "PENDING",
      },
    });
  }

  static async deleteDocument(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId }, // SEGURANÇA
      },
    });

    if (document.filePath) {
      const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .remove([document.filePath]);

      if (error) {
        console.error(
          "Supabase storage deletion error (documents):",
          error.message
        );
      }
    }

    await prisma.patientDocument.delete({
      where: { id: documentId },
    });
  }

  static async getDocumentDownloadUrl(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId }, // SEGURANÇA
      },
    });

    if (!document.filePath) {
      throw new Error("Document file not found");
    }

    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(document.filePath, 3600);

    if (error || !data) {
      console.error("Error creating signed URL:", error);
      throw new Error("Could not generate download URL");
    }

    return {
      signedUrl: data.signedUrl,
      fileName: document.fileName,
      fileType: document.fileType,
    };
  }

  static async getAttachmentDownloadUrl(
    attachmentId: string,
    clinicId: string
  ) {
    const attachment = await prisma.attachment.findFirstOrThrow({
      where: {
        id: attachmentId,
        patient: { clinicId }, // SEGURANÇA
      },
    });

    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.filePath, 3600, {
        download: attachment.fileName,
      });

    if (error || !data) {
      console.error(
        "Error creating signed download URL for attachment:",
        error
      );
      throw new Error("Could not generate download URL");
    }

    return { signedUrl: data.signedUrl };
  }
}
