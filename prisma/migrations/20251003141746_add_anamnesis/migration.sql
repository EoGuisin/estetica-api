-- CreateEnum
CREATE TYPE "public"."QuestionType" AS ENUM ('YES_NO', 'SHORT_TEXT', 'LONG_TEXT', 'SINGLE_SELECT', 'MULTIPLE_SELECT', 'SCALE', 'DATE');

-- CreateTable
CREATE TABLE "public"."anamnesis_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "clinicId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anamnesis_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anamnesis_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "anamnesis_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anamnesis_questions" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."QuestionType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "options" JSONB,
    "parentQuestionId" TEXT,
    "showCondition" JSONB,

    CONSTRAINT "anamnesis_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."patient_assessments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "templateId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."assessment_responses" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_assessments_appointmentId_key" ON "public"."patient_assessments"("appointmentId");

-- CreateIndex
CREATE INDEX "patient_assessments_patientId_idx" ON "public"."patient_assessments"("patientId");

-- CreateIndex
CREATE INDEX "patient_assessments_appointmentId_idx" ON "public"."patient_assessments"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_assessmentId_questionId_key" ON "public"."assessment_responses"("assessmentId", "questionId");

-- AddForeignKey
ALTER TABLE "public"."anamnesis_templates" ADD CONSTRAINT "anamnesis_templates_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anamnesis_sections" ADD CONSTRAINT "anamnesis_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."anamnesis_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anamnesis_questions" ADD CONSTRAINT "anamnesis_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."anamnesis_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anamnesis_questions" ADD CONSTRAINT "anamnesis_questions_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "public"."anamnesis_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patient_assessments" ADD CONSTRAINT "patient_assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "public"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patient_assessments" ADD CONSTRAINT "patient_assessments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patient_assessments" ADD CONSTRAINT "patient_assessments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."anamnesis_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patient_assessments" ADD CONSTRAINT "patient_assessments_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."patient_assessments" ADD CONSTRAINT "patient_assessments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "public"."clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assessment_responses" ADD CONSTRAINT "assessment_responses_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."patient_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."assessment_responses" ADD CONSTRAINT "assessment_responses_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."anamnesis_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
