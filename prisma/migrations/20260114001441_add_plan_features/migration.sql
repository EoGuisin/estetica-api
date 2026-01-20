/*
  Warnings:

  - You are about to drop the column `clinicLimit` on the `subscription_plans` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripePriceId]` on the table `subscription_plans` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `stripePriceId` to the `subscription_plans` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."subscription_plans" DROP COLUMN "clinicLimit",
ADD COLUMN     "hasAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasAutomation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCrm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasReports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "interval" TEXT NOT NULL DEFAULT 'month',
ADD COLUMN     "storageLimitGb" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "stripePriceId" TEXT NOT NULL,
ADD COLUMN     "userLimit" INTEGER NOT NULL DEFAULT 5;

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_stripePriceId_key" ON "public"."subscription_plans"("stripePriceId");
