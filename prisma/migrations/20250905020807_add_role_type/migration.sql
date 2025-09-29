-- CreateEnum
CREATE TYPE "public"."RoleType" AS ENUM ('ADMIN', 'PROFESSIONAL', 'SECRETARY', 'FINANCIAL');

-- AlterTable
ALTER TABLE "public"."roles" ADD COLUMN     "type" "public"."RoleType" NOT NULL DEFAULT 'ADMIN';
