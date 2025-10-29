/*
  Warnings:

  - You are about to drop the column `ownerId` on the `clinics` table. All the data in the column will be lost.
  - You are about to drop the `subscription_plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."clinics" DROP CONSTRAINT "clinics_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."subscriptions" DROP CONSTRAINT "subscriptions_planId_fkey";

-- DropForeignKey
ALTER TABLE "public"."subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- AlterTable
ALTER TABLE "public"."clinics" DROP COLUMN "ownerId";

-- DropTable
DROP TABLE "public"."subscription_plans";

-- DropTable
DROP TABLE "public"."subscriptions";
