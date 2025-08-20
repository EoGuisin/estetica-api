/*
  Warnings:

  - You are about to drop the `_ProfissionalEspecialidades` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agendamentos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clinicas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `enderecos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `especialidades` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `funcoes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pacientes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `planos_tratamento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `planos_tratamento_procedimentos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `procedimentos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `telefones` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tipos_agendamento` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usuarios` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."_ProfissionalEspecialidades" DROP CONSTRAINT "_ProfissionalEspecialidades_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ProfissionalEspecialidades" DROP CONSTRAINT "_ProfissionalEspecialidades_B_fkey";

-- DropForeignKey
ALTER TABLE "public"."agendamentos" DROP CONSTRAINT "agendamentos_pacienteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."agendamentos" DROP CONSTRAINT "agendamentos_planoTratamentoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."agendamentos" DROP CONSTRAINT "agendamentos_profissionalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."agendamentos" DROP CONSTRAINT "agendamentos_tipoAgendamentoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."clinicas" DROP CONSTRAINT "clinicas_enderecoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."pacientes" DROP CONSTRAINT "pacientes_clinicaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."pacientes" DROP CONSTRAINT "pacientes_enderecoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."planos_tratamento" DROP CONSTRAINT "planos_tratamento_clinicaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."planos_tratamento" DROP CONSTRAINT "planos_tratamento_pacienteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."planos_tratamento" DROP CONSTRAINT "planos_tratamento_vendedorId_fkey";

-- DropForeignKey
ALTER TABLE "public"."planos_tratamento_procedimentos" DROP CONSTRAINT "planos_tratamento_procedimentos_planoTratamentoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."planos_tratamento_procedimentos" DROP CONSTRAINT "planos_tratamento_procedimentos_procedimentoId_fkey";

-- DropForeignKey
ALTER TABLE "public"."procedimentos" DROP CONSTRAINT "procedimentos_especialidadeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."telefones" DROP CONSTRAINT "telefones_pacienteId_fkey";

-- DropForeignKey
ALTER TABLE "public"."usuarios" DROP CONSTRAINT "usuarios_clinicaId_fkey";

-- DropForeignKey
ALTER TABLE "public"."usuarios" DROP CONSTRAINT "usuarios_funcaoId_fkey";

-- DropTable
DROP TABLE "public"."_ProfissionalEspecialidades";

-- DropTable
DROP TABLE "public"."agendamentos";

-- DropTable
DROP TABLE "public"."clinicas";

-- DropTable
DROP TABLE "public"."enderecos";

-- DropTable
DROP TABLE "public"."especialidades";

-- DropTable
DROP TABLE "public"."funcoes";

-- DropTable
DROP TABLE "public"."pacientes";

-- DropTable
DROP TABLE "public"."planos_tratamento";

-- DropTable
DROP TABLE "public"."planos_tratamento_procedimentos";

-- DropTable
DROP TABLE "public"."procedimentos";

-- DropTable
DROP TABLE "public"."telefones";

-- DropTable
DROP TABLE "public"."tipos_agendamento";

-- DropTable
DROP TABLE "public"."usuarios";

-- CreateTable
CREATE TABLE "public"."clinics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "addressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "electronicSignature" TEXT,
    "scheduleStartHour" TEXT,
    "scheduleEndHour" TEXT,
    "appointmentDuration" INTEGER,
    "notes" TEXT,
    "clinicId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."patients" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT,
    "cpf" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "socialName" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "identityCard" TEXT,
    "gender" TEXT,
    "ethnicity" TEXT,
    "motherName" TEXT,
    "occupation" TEXT,
    "notes" TEXT,
    "trafficSource" TEXT,
    "clinicId" TEXT NOT NULL,
    "guardianName" TEXT,
    "guardianBirthDate" TIMESTAMP(3),
    "addressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."addresses" (
    "id" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."phones" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "patientId" TEXT NOT NULL,

    CONSTRAINT "phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."specialties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."procedures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardPrice" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "specialtyId" TEXT NOT NULL,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."treatment_plans" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2),
    "discountPercentage" DECIMAL(5,2),
    "surcharge" DECIMAL(10,2),
    "total" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."treatment_plan_procedures" (
    "id" TEXT NOT NULL,
    "treatmentPlanId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "contractedSessions" INTEGER NOT NULL,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "followUps" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "treatment_plan_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointments" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "patientId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "appointmentTypeId" TEXT NOT NULL,
    "treatmentPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appointment_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ProfessionalSpecialties" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfessionalSpecialties_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinics_taxId_key" ON "public"."clinics"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "public"."users"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "patients_cpf_key" ON "public"."patients"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_key" ON "public"."specialties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_types_name_key" ON "public"."appointment_types"("name");

-- CreateIndex
CREATE INDEX "_ProfessionalSpecialties_B_index" ON "public"."_ProfessionalSpecialties"("B");

-- AddForeignKey
ALTER TABLE "public"."clinics" ADD CONSTRAINT "clinics_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patients" ADD CONSTRAINT "patients_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."phones" ADD CONSTRAINT "phones_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."procedures" ADD CONSTRAINT "procedures_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "public"."specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."treatment_plans" ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."treatment_plans" ADD CONSTRAINT "treatment_plans_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."treatment_plans" ADD CONSTRAINT "treatment_plans_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."treatment_plan_procedures" ADD CONSTRAINT "treatment_plan_procedures_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "public"."treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."treatment_plan_procedures" ADD CONSTRAINT "treatment_plan_procedures_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "public"."procedures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "public"."appointment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appointments" ADD CONSTRAINT "appointments_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "public"."treatment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfessionalSpecialties" ADD CONSTRAINT "_ProfessionalSpecialties_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfessionalSpecialties" ADD CONSTRAINT "_ProfessionalSpecialties_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
