/*
  Warnings:

  - A unique constraint covering the columns `[name,clinicId]` on the table `product_brands` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,clinicId]` on the table `product_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name,clinicId]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clinicId` to the `product_brands` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicId` to the `product_categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clinicId` to the `suppliers` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."product_brands_name_key";

-- DropIndex
DROP INDEX "public"."suppliers_name_key";

-- AlterTable
ALTER TABLE "public"."product_brands" ADD COLUMN     "clinicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."product_categories" ADD COLUMN     "clinicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."suppliers" ADD COLUMN     "clinicId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_brands_name_clinicId_key" ON "public"."product_brands"("name", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_clinicId_key" ON "public"."product_categories"("name", "clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_clinicId_key" ON "public"."suppliers"("name", "clinicId");

-- AddForeignKey
ALTER TABLE "public"."product_categories" ADD CONSTRAINT "product_categories_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_brands" ADD CONSTRAINT "product_brands_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."suppliers" ADD CONSTRAINT "suppliers_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
