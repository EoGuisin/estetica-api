-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "workingDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
