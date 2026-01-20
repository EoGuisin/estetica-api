/*
  Warnings:

  - A unique constraint covering the columns `[cpf,clinicId]` on the table `patients` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."patients_cpf_key";

-- CreateIndex
CREATE UNIQUE INDEX "patients_cpf_clinicId_key" ON "public"."patients"("cpf", "clinicId");
