-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CASH', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CommissionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED');

-- CreateTable
CREATE TABLE "public"."payment_installments" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(10,2),
    "paymentDate" TIMESTAMP(3),
    "paymentMethod" "public"."PaymentMethod",
    "notes" TEXT,
    "clinicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."expenses" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "supplierId" TEXT,
    "categoryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commission_records" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "paymentInstallmentId" TEXT,
    "calculatedAmount" DECIMAL(10,2) NOT NULL,
    "calculationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_installments_treatmentPlanId_idx" ON "public"."payment_installments"("treatmentPlanId");

-- CreateIndex
CREATE INDEX "payment_installments_status_idx" ON "public"."payment_installments"("status");

-- CreateIndex
CREATE INDEX "payment_installments_dueDate_idx" ON "public"."payment_installments"("dueDate");

-- CreateIndex
CREATE INDEX "payment_installments_clinicId_idx" ON "public"."payment_installments"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_name_clinicId_key" ON "public"."expense_categories"("name", "clinicId");

-- CreateIndex
CREATE INDEX "expenses_clinicId_idx" ON "public"."expenses"("clinicId");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "public"."expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_dueDate_idx" ON "public"."expenses"("dueDate");

-- CreateIndex
CREATE INDEX "commission_records_clinicId_idx" ON "public"."commission_records"("clinicId");

-- CreateIndex
CREATE INDEX "commission_records_professionalId_idx" ON "public"."commission_records"("professionalId");

-- CreateIndex
CREATE INDEX "commission_records_status_idx" ON "public"."commission_records"("status");

-- AddForeignKey
ALTER TABLE "public"."payment_installments" ADD CONSTRAINT "payment_installments_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "public"."treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_installments" ADD CONSTRAINT "payment_installments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expense_categories" ADD CONSTRAINT "expense_categories_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_records" ADD CONSTRAINT "commission_records_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_records" ADD CONSTRAINT "commission_records_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_records" ADD CONSTRAINT "commission_records_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "public"."treatment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_records" ADD CONSTRAINT "commission_records_paymentInstallmentId_fkey" FOREIGN KEY ("paymentInstallmentId") REFERENCES "public"."payment_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
