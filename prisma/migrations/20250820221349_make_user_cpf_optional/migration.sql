-- CreateEnum
CREATE TYPE "public"."ClinicStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'INACTIVE', 'CANCELED');

-- AlterTable
ALTER TABLE "public"."clinics" ADD COLUMN     "status" "public"."ClinicStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "public"."users" ALTER COLUMN "cpf" DROP NOT NULL;
