-- AlterTable
ALTER TABLE "public"."anamnesis_templates" ADD COLUMN     "category" TEXT,
ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "professionalType" TEXT;
