/*
  Warnings:

  - You are about to drop the column `treatmentPlanProcedureId` on the `appointments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_treatmentPlanProcedureId_fkey";

-- AlterTable
ALTER TABLE "public"."appointments" DROP COLUMN "treatmentPlanProcedureId";

-- AlterTable
ALTER TABLE "public"."ticket_messages" ALTER COLUMN "createdAt" SET DEFAULT NOW();

-- CreateTable
CREATE TABLE "public"."_AppointmentToTreatmentPlanProcedure" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AppointmentToTreatmentPlanProcedure_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AppointmentToTreatmentPlanProcedure_B_index" ON "public"."_AppointmentToTreatmentPlanProcedure"("B");

-- AddForeignKey
ALTER TABLE "public"."_AppointmentToTreatmentPlanProcedure" ADD CONSTRAINT "_AppointmentToTreatmentPlanProcedure_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AppointmentToTreatmentPlanProcedure" ADD CONSTRAINT "_AppointmentToTreatmentPlanProcedure_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."treatment_plan_procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
