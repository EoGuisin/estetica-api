-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('REVENUE', 'EXPENSE', 'TRANSFER');

-- CreateTable
CREATE TABLE "public"."bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."financial_transactions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "targetBankAccountId" TEXT,
    "paymentInstallmentId" TEXT,
    "expenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_name_clinicId_key" ON "public"."bank_accounts"("name", "clinicId");

-- CreateIndex
CREATE INDEX "financial_transactions_clinicId_date_idx" ON "public"."financial_transactions"("clinicId", "date");

-- AddForeignKey
ALTER TABLE "public"."bank_accounts" ADD CONSTRAINT "bank_accounts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "public"."bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_targetBankAccountId_fkey" FOREIGN KEY ("targetBankAccountId") REFERENCES "public"."bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_paymentInstallmentId_fkey" FOREIGN KEY ("paymentInstallmentId") REFERENCES "public"."payment_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."financial_transactions" ADD CONSTRAINT "financial_transactions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
