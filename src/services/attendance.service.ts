import { prisma } from "../lib/prisma";
import { supabase } from "../lib/supabase";
import { randomUUID } from "crypto";
import { saveAttachmentSchema } from "../schemas/attendance.schema";
import { z } from "zod";

const ATTACHMENTS_BUCKET = "attachments";

export class AttendanceService {
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
      },
      orderBy: { date: "desc" },
    });

    const beforeAfterImages = await prisma.beforeAfterImage.findMany({
      where: { patientId: appointment.patient.id },
      orderBy: { createdAt: "desc" },
    });

    // Add public URLs for images
    const imagesWithUrls = beforeAfterImages.map((image) => ({
      ...image,
      beforeImagePath: supabase.storage
        .from("before-after")
        .getPublicUrl(image.beforeImagePath).data.publicUrl,
      afterImagePath: image.afterImagePath
        ? supabase.storage
            .from("before-after")
            .getPublicUrl(image.afterImagePath).data.publicUrl
        : null,
    }));

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

    // Add public URLs for each attachment
    return attachments.map((attachment) => {
      const { data } = supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .getPublicUrl(attachment.filePath);
      return { ...attachment, publicUrl: data.publicUrl };
    });
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
}
