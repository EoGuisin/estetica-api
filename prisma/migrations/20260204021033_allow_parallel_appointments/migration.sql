-- AlterTable
ALTER TABLE "public"."clinics" ADD COLUMN     "allowParallelAppointments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parallelAppointmentsLimit" INTEGER NOT NULL DEFAULT 1;
