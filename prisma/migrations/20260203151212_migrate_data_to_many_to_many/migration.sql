/*
MODIFICAÇÃO MANUAL:
1. Cria a tabela nova primeiro.
2. Cria as chaves estrangeiras.
3. Copia os dados da coluna antiga para a tabela nova.
4. Só depois apaga a coluna antiga.
 */
-- 1. CreateTable (Cria a nova tabela vazia)
CREATE TABLE
  "public"."_UserClinics" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_UserClinics_AB_pkey" PRIMARY KEY ("A", "B")
  );

-- 2. CreateIndex & Foreign Keys (Prepara a tabela para receber dados)
CREATE INDEX "_UserClinics_B_index" ON "public"."_UserClinics" ("B");

ALTER TABLE "public"."_UserClinics" ADD CONSTRAINT "_UserClinics_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."clinics" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."_UserClinics" ADD CONSTRAINT "_UserClinics_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===============================================================
-- 🚨 SCRIPT DE MIGRAÇÃO DE DADOS 🚨
-- Copia os IDs antes de apagar a coluna
-- "A" = Clinic (Ordem alfabética C vem antes de U)
-- "B" = User
-- ===============================================================
INSERT INTO
  "public"."_UserClinics" ("A", "B")
SELECT
  "clinicId",
  "id"
FROM
  "public"."users"
WHERE
  "clinicId" IS NOT NULL;

-- ===============================================================
-- FIM DO SCRIPT - AGORA É SEGURO APAGAR
-- ===============================================================
-- 3. DropForeignKey (Remove a restrição antiga)
ALTER TABLE "public"."users"
DROP CONSTRAINT "users_clinicId_fkey";

-- 4. AlterTable (Apaga a coluna antiga)
ALTER TABLE "public"."users"
DROP COLUMN "clinicId";