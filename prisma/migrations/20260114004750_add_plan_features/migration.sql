/*
  Warnings:

  - You are about to drop the column `clinicLimit` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `subscriptions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeCustomerId]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `currentMaxStorage` to the `subscriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentMaxUsers` to the `subscriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentPeriodEnd` to the `subscriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentPeriodStart` to the `subscriptions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."accounts" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "public"."clinics" ADD COLUMN     "storageUsed" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."subscription_plans" DROP COLUMN "clinicLimit",
ADD COLUMN     "hasAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasApp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCrm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasFunnel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasWhats" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxStorage" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "maxUsers" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeProductId" TEXT;

-- AlterTable
ALTER TABLE "public"."subscriptions" DROP COLUMN "endDate",
DROP COLUMN "startDate",
ADD COLUMN     "activeAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activeApp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activeCrm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activeFunnel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "activeWhats" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentMaxStorage" BIGINT NOT NULL,
ADD COLUMN     "currentMaxUsers" INTEGER NOT NULL,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_stripeCustomerId_key" ON "public"."accounts"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "public"."subscriptions"("stripeSubscriptionId");
