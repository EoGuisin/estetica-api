-- AlterTable
ALTER TABLE "public"."products" ADD COLUMN     "lastCostPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."ticket_messages" ALTER COLUMN "createdAt" SET DEFAULT NOW();
