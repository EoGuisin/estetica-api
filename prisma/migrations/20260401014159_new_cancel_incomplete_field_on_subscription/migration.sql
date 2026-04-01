-- AlterTable
ALTER TABLE "public"."subscriptions" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."ticket_messages" ALTER COLUMN "createdAt" SET DEFAULT NOW();
