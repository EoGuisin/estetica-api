/*
  Warnings:

  - A unique constraint covering the columns `[sku,clinicId]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clinicId` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."products" ADD COLUMN     "clinicId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_clinicId_key" ON "public"."products"("sku", "clinicId");

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
