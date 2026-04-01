-- CreateEnum
CREATE TYPE "public"."AppointmentCategory" AS ENUM ('EVALUATION', 'SESSION', 'RETURN');

-- AlterTable
ALTER TABLE "public"."appointments" ADD COLUMN     "category" "public"."AppointmentCategory" NOT NULL DEFAULT 'SESSION';

-- AlterTable
ALTER TABLE "public"."ticket_messages" ALTER COLUMN "createdAt" SET DEFAULT NOW();
