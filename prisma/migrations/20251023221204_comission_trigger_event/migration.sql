-- CreateEnum
CREATE TYPE "public"."CommissionTriggerEvent" AS ENUM ('ON_SALE', 'ON_FIRST_INSTALLMENT_PAID', 'ON_FULL_PLAN_PAID', 'ON_EACH_INSTALLMENT_PAID');

-- AlterTable
ALTER TABLE "public"."commission_plans" ADD COLUMN     "triggerEvent" "public"."CommissionTriggerEvent" NOT NULL DEFAULT 'ON_FULL_PLAN_PAID';
