-- AlterTable
ALTER TABLE "public"."patient_documents" ADD COLUMN     "templateId" TEXT;

-- CreateTable
CREATE TABLE "public"."specialty_templates" (
    "id" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."DocumentType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialty_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."patient_documents" ADD CONSTRAINT "patient_documents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."specialty_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."specialty_templates" ADD CONSTRAINT "specialty_templates_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "public"."specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
