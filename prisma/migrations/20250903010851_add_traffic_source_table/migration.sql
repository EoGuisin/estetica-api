/*
  Warnings:

  - You are about to drop the column `trafficSource` on the `patients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."patients" DROP COLUMN "trafficSource",
ADD COLUMN     "trafficSourceId" TEXT;

-- CreateTable
CREATE TABLE "public"."traffic_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "traffic_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traffic_sources_name_key" ON "public"."traffic_sources"("name");

-- AddForeignKey
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "public"."traffic_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
