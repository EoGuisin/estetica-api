/*
  Warnings:

  - A unique constraint covering the columns `[name,clinicId]` on the table `appointment_types` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,clinicId]` on the table `professional_councils` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,clinicId]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,clinicId]` on the table `specialties` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,clinicId]` on the table `traffic_sources` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."appointment_types_name_key";

-- DropIndex
DROP INDEX "public"."professional_councils_name_key";

-- DropIndex
DROP INDEX "public"."roles_name_key";

-- DropIndex
DROP INDEX "public"."specialties_name_key";

-- DropIndex
DROP INDEX "public"."traffic_sources_name_key";

-- AlterTable
ALTER TABLE "public"."appointment_types" ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "public"."professional_councils" ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "public"."roles" ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "public"."specialties" ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "public"."traffic_sources" ADD COLUMN     "clinicId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appointment_types_name_clinicId_key" ON "public"."appointment_types"("name", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "professional_councils_name_clinicId_key" ON "public"."professional_councils"("name", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_clinicId_key" ON "public"."roles"("name", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_clinicId_key" ON "public"."specialties"("name", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "traffic_sources_name_clinicId_key" ON "public"."traffic_sources"("name", "clinicId");

-- AddForeignKey
ALTER TABLE "public"."professional_councils" ADD CONSTRAINT "professional_councils_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."traffic_sources" ADD CONSTRAINT "traffic_sources_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roles" ADD CONSTRAINT "roles_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."specialties" ADD CONSTRAINT "specialties_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointment_types" ADD CONSTRAINT "appointment_types_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
