import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import { randomUUID } from "crypto";
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

export class AttendanceService {
  static async getTemplatesForPatient(
    patientId: string,
    type: DocumentType
  ): Promise<any[]> {
    // Get patient's treatment plan to find specialty
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      include: {
        treatmentPlans: {
          include: {
            procedures: {
              include: {
                procedure: {
                  include: {
                    specialty: {
                      include: {
                        templates: {
                          where: {
                            type,
                            isActive: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!patient.treatmentPlans.length) {
      return [];
    }

    const specialty =
      patient.treatmentPlans[0].procedures[0]?.procedure?.specialty;

    if (!specialty) {
      return [];
    }

    return specialty.templates || [];
  }

  static async generateDocumentFromTemplate(data: {
    patientId: string;
    templateId: string;
    clinicId: string;
  }) {
    // Get template
    const template = await prisma.specialtyTemplate.findUniqueOrThrow({
      where: { id: data.templateId },
      include: { specialty: true },
    });

    // Get patient data
    const patient = await prisma.patient.findUniqueOrThrow({
      where: { id: data.patientId },
      include: {
        address: true,
        phones: true,
        treatmentPlans: {
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
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Get clinic data
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: data.clinicId },
      include: { address: true },
    });

    // Prepare treatment plan data
    let treatmentPlanData = null;
    if (patient.treatmentPlans.length > 0) {
      const plan = patient.treatmentPlans[0];
      const procedure = plan.procedures[0];
      treatmentPlanData = {
        specialty: procedure?.procedure?.specialty?.name,
        procedure: procedure?.procedure?.name,
        sessions: procedure?.contractedSessions,
        total: plan.total,
      };
    }

    // Substitute variables in template
    const filledContent = substituteVariables(template.content, {
      patient,
      clinic,
      treatmentPlan: treatmentPlanData,
    });

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${template.type.toLowerCase()}_${patient.name.replace(
      / /g,
      "_"
    )}_${timestamp}.pdf`;
    const filePath = `${data.clinicId}/${data.patientId}/${fileName}`;

    // Generate PDF
    const pdfBuffer = await this.generatePDFFromHTML(
      filledContent,
      clinic,
      template.name
    );

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      throw new Error("Could not upload generated document");
    }

    // Save to database
    const document = await prisma.patientDocument.create({
      data: {
        patientId: data.patientId,
        templateId: data.templateId,
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
      where: { id: appointmentId, patient: { clinicId } },
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
      where: { patientId: appointment.patient.id },
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

    const patientHistory = await prisma.appointment.findMany({
      where: { patientId: appointment.patient.id },
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
      ...appointment,
      assessments,
      patientHistory,
      patient: {
        ...appointment.patient,
        beforeAfterImages: imagesWithUrls,
      },
    };
  }

  static async saveDiagnosis(
    appointmentId: string,
    diagnosis: string | null | undefined
  ) {
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

  static async listAttachments(patientId: string) {
    const attachments = await prisma.attachment.findMany({
      where: { patientId },
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
    const fileExtension = data.fileName.split(".").pop();
    const uniqueFileName = `${randomUUID()}.${fileExtension}`;
    const filePath = `${data.clinicId}/${data.patientId}/${uniqueFileName}`;

    // ================= FIX IS HERE =================
    // The second argument `60` is removed. The function no longer takes an expiration time.
    // It uses a default expiration set by Supabase (usually one hour).
    const { data: signedUrlData, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error("Supabase signed URL error:", error);
      throw new Error("Could not create signed upload URL");
    }
    // ===============================================

    return { ...signedUrlData, filePath };
  }

  static async saveAttachment(data: z.infer<typeof saveAttachmentSchema>) {
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
        patient: { clinicId },
      },
    });

    const { error: storageError } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove([attachment.filePath]);

    if (storageError) {
      // Log the error but don't block DB deletion if file is already gone
      console.error("Supabase storage deletion error:", storageError.message);
    }

    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // ================= FIX IS HERE =================
    // The redundant "return;" has been removed.
    // ===============================================
  }

  static async getBeforeAfterImages(patientId: string) {
    const images = await prisma.beforeAfterImage.findMany({
      where: { patientId },
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
      where: { id: imageId, patient: { clinicId } },
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
    data: z.infer<typeof saveBeforeAfterSchema>
  ) {
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

  static async updateAfterImage(imageId: string, afterImagePath: string) {
    return prisma.beforeAfterImage.update({
      where: { id: imageId },
      data: { afterImagePath },
    });
  }

  static async deleteBeforeAfterImage(imageId: string, clinicId: string) {
    const image = await prisma.beforeAfterImage.findFirstOrThrow({
      where: {
        id: imageId,
        patient: { clinicId }, // Garante que a imagem pertence à clínica do usuário
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

  // List documents by patient and type
  static async listDocuments(patientId: string, type: DocumentType) {
    const documents = await prisma.patientDocument.findMany({
      where: {
        patientId,
        type,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return documents;
  }

  // Create signed URL for document upload
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

  // Save document metadata to database
  static async saveDocument(data: {
    patientId: string;
    fileName: string;
    description?: string | null;
    filePath: string;
    fileType: string;
    size: number;
    documentType: DocumentType;
  }) {
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

  // Delete a document
  static async deleteDocument(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId },
      },
    });

    // Remove from storage
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

    // Delete from database
    await prisma.patientDocument.delete({
      where: { id: documentId },
    });
  }

  // Get signed download URL
  static async getDocumentDownloadUrl(documentId: string, clinicId: string) {
    const document = await prisma.patientDocument.findFirstOrThrow({
      where: {
        id: documentId,
        patient: { clinicId },
      },
    });

    if (!document.filePath) {
      throw new Error("Document file not found");
    }

    // Create a signed URL that expires in 1 hour
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(document.filePath, 3600); // 3600 seconds = 1 hour

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
        patient: { clinicId },
      },
    });

    const { data, error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(attachment.filePath, 3600, {
        // 1 hour expiration
        download: attachment.fileName, // This prompts a download with the correct filename
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
