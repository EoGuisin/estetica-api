/*
  Warnings:

  - You are about to drop the column `documentTemplateId` on the `patient_documents` table. All the data in the column will be lost.
  - You are about to drop the `document_templates` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `fileName` to the `patient_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileType` to the `patient_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `patient_documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `patient_documents` table without a default value. This is not possible if the table is not empty.
  - Made the column `filePath` on table `patient_documents` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."document_templates" DROP CONSTRAINT "document_templates_clinicId_fkey";

-- DropForeignKey
ALTER TABLE "public"."patient_documents" DROP CONSTRAINT "patient_documents_documentTemplateId_fkey";

-- AlterTable
ALTER TABLE "public"."patient_documents" DROP COLUMN "documentTemplateId",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "fileType" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "type" "public"."DocumentType" NOT NULL,
ALTER COLUMN "filePath" SET NOT NULL;

-- DropTable
DROP TABLE "public"."document_templates";
