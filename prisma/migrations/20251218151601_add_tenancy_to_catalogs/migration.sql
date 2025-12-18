-- AlterTable
ALTER TABLE "public"."procedures" ADD COLUMN     "clinicId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."procedures" ADD CONSTRAINT "procedures_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
