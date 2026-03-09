-- AlterTable
ALTER TABLE "public"."patient_documents" ADD COLUMN     "documentHash" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;
