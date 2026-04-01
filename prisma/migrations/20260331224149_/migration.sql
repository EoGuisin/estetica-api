-- AlterTable
ALTER TABLE "public"."ticket_messages" ALTER COLUMN "createdAt" SET DEFAULT NOW();

-- CreateTable
CREATE TABLE "public"."cancelation_feedbacks" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancelation_feedbacks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."cancelation_feedbacks" ADD CONSTRAINT "cancelation_feedbacks_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
