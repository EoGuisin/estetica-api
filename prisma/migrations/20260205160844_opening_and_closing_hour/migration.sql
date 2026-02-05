-- AlterTable
ALTER TABLE "public"."clinics" ADD COLUMN     "closingHour" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN     "openingHour" TEXT NOT NULL DEFAULT '08:00';
