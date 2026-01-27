-- CreateEnum
CREATE TYPE "public"."TreatmentPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'CANCELED');

-- AlterTable
ALTER TABLE "public"."treatment_plans" ADD COLUMN     "installmentCount" INTEGER DEFAULT 1,
ADD COLUMN     "status" "public"."TreatmentPlanStatus" NOT NULL DEFAULT 'APPROVED';
