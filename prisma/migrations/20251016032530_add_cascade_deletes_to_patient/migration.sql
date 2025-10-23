-- DropForeignKey
ALTER TABLE "public"."appointments" DROP CONSTRAINT "appointments_patientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."patient_assessments" DROP CONSTRAINT "patient_assessments_patientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."treatment_plans" DROP CONSTRAINT "treatment_plans_patientId_fkey";

-- AddForeignKey
ALTER TABLE "public"."treatment_plans" ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patient_assessments" ADD CONSTRAINT "patient_assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
