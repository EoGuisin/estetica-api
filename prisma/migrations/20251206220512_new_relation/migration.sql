-- AlterTable
ALTER TABLE "public"."appointments" ADD COLUMN     "treatmentPlanProcedureId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_treatmentPlanProcedureId_fkey" FOREIGN KEY ("treatmentPlanProcedureId") REFERENCES "public"."treatment_plan_procedures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
