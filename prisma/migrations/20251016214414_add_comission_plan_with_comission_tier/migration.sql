-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "commissionPlanId" TEXT;

-- CreateTable
CREATE TABLE "public"."commission_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "clinicId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commission_tiers" (
    "id" TEXT NOT NULL,
    "commissionPlanId" TEXT NOT NULL,
    "minThreshold" DECIMAL(10,2) NOT NULL,
    "maxThreshold" DECIMAL(10,2),
    "percentage" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_tiers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "public"."commission_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_plans" ADD CONSTRAINT "commission_plans_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_tiers" ADD CONSTRAINT "commission_tiers_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "public"."commission_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
