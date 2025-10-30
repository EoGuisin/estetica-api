-- CreateEnum
CREATE TYPE "public"."CashRegisterSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "public"."financial_transactions" ADD COLUMN     "cashRegisterSessionId" TEXT;

-- CreateTable
CREATE TABLE "public"."cash_register_sessions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingBalance" DECIMAL(10,2) NOT NULL,
    "observedOpening" DECIMAL(10,2) NOT NULL,
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closingBalance" DECIMAL(10,2),
    "observedClosing" DECIMAL(10,2),
    "discrepancy" DECIMAL(10,2),
    "status" "public"."CashRegisterSessionStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,

    CONSTRAINT "cash_register_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_register_sessions_clinicId_status_idx" ON "public"."cash_register_sessions"("clinicId", "status");

-- CreateIndex
CREATE INDEX "cash_register_sessions_bankAccountId_status_idx" ON "public"."cash_register_sessions"("bankAccountId", "status");

-- AddForeignKey
ALTER TABLE "public"."cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "public"."bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cash_register_sessions" ADD CONSTRAINT "cash_register_sessions_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_cashRegisterSessionId_fkey" FOREIGN KEY ("cashRegisterSessionId") REFERENCES "public"."cash_register_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
