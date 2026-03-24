-- DropForeignKey
ALTER TABLE "public"."anamnesis_templates" DROP CONSTRAINT "anamnesis_templates_clinicId_fkey";

-- AlterTable
ALTER TABLE "public"."anamnesis_templates" ALTER COLUMN "clinicId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."anamnesis_templates" ADD CONSTRAINT "anamnesis_templates_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
