-- AlterTable
ALTER TABLE "public"."patient_documents" ADD COLUMN     "professionalId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."patient_documents" ADD CONSTRAINT "patient_documents_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
