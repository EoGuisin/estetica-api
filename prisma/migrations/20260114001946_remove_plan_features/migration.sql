/*
  Warnings:

  - You are about to drop the column `hasAi` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `hasAutomation` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `hasCrm` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `hasReports` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `interval` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `storageLimitGb` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripePriceId` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `userLimit` on the `subscription_plans` table. All the data in the column will be lost.
  - Added the required column `clinicLimit` to the `subscription_plans` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."subscription_plans_stripePriceId_key";

-- AlterTable
ALTER TABLE "public"."subscription_plans" DROP COLUMN "hasAi",
DROP COLUMN "hasAutomation",
DROP COLUMN "hasCrm",
DROP COLUMN "hasReports",
DROP COLUMN "interval",
DROP COLUMN "storageLimitGb",
DROP COLUMN "stripePriceId",
DROP COLUMN "userLimit",
ADD COLUMN     "clinicLimit" INTEGER NOT NULL;
