-- CreateTable
CREATE TABLE "public"."clinicas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "enderecoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usuarios" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "senhaHash" TEXT NOT NULL,
    "assinaturaEletronica" TEXT,
    "horaInicialAgenda" TEXT,
    "horaFinalAgenda" TEXT,
    "tempoAtendimento" INTEGER,
    "observacao" TEXT,
    "clinicaId" TEXT NOT NULL,
    "funcaoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pacientes" (
    "id" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeSocial" TEXT,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "identidade" TEXT,
    "sexo" TEXT,
    "etnia" TEXT,
    "nomeMae" TEXT,
    "profissao" TEXT,
    "observacao" TEXT,
    "fonteTrafego" TEXT,
    "clinicaId" TEXT NOT NULL,
    "nomeResponsavel" TEXT,
    "dataNascimentoResponsavel" TIMESTAMP(3),
    "enderecoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."enderecos" (
    "id" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."telefones" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "isWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "pacienteId" TEXT NOT NULL,

    CONSTRAINT "telefones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."funcoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,

    CONSTRAINT "funcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."especialidades" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "especialidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."procedimentos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorPadrao" DECIMAL(10,2) NOT NULL,
    "descricao" TEXT,
    "especialidadeId" TEXT NOT NULL,

    CONSTRAINT "procedimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."planos_tratamento" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "clinicaId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descontoReais" DECIMAL(10,2),
    "descontoPct" DECIMAL(5,2),
    "acrescimo" DECIMAL(10,2),
    "total" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planos_tratamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."planos_tratamento_procedimentos" (
    "id" TEXT NOT NULL,
    "planoTratamentoId" TEXT NOT NULL,
    "procedimentoId" TEXT NOT NULL,
    "sessoesContratadas" INTEGER NOT NULL,
    "sessoesRealizadas" INTEGER NOT NULL DEFAULT 0,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "retornos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "planos_tratamento_procedimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agendamentos" (
    "id" TEXT NOT NULL,
    "dataAgendamento" TIMESTAMP(3) NOT NULL,
    "horarioInicio" TEXT NOT NULL,
    "horarioFim" TEXT NOT NULL,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "pacienteId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "tipoAgendamentoId" TEXT NOT NULL,
    "planoTratamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tipos_agendamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "tipos_agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ProfissionalEspecialidades" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfissionalEspecialidades_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinicas_cnpj_key" ON "public"."clinicas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "public"."usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "public"."usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_cpf_key" ON "public"."pacientes"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "funcoes_nome_key" ON "public"."funcoes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "especialidades_nome_key" ON "public"."especialidades"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_agendamento_nome_key" ON "public"."tipos_agendamento"("nome");

-- CreateIndex
CREATE INDEX "_ProfissionalEspecialidades_B_index" ON "public"."_ProfissionalEspecialidades"("B");

-- AddForeignKey
ALTER TABLE "public"."clinicas" ADD CONSTRAINT "clinicas_enderecoId_fkey" FOREIGN KEY ("enderecoId") REFERENCES "public"."enderecos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuarios" ADD CONSTRAINT "usuarios_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usuarios" ADD CONSTRAINT "usuarios_funcaoId_fkey" FOREIGN KEY ("funcaoId") REFERENCES "public"."funcoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pacientes" ADD CONSTRAINT "pacientes_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pacientes" ADD CONSTRAINT "pacientes_enderecoId_fkey" FOREIGN KEY ("enderecoId") REFERENCES "public"."enderecos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."telefones" ADD CONSTRAINT "telefones_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."procedimentos" ADD CONSTRAINT "procedimentos_especialidadeId_fkey" FOREIGN KEY ("especialidadeId") REFERENCES "public"."especialidades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."planos_tratamento" ADD CONSTRAINT "planos_tratamento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."planos_tratamento" ADD CONSTRAINT "planos_tratamento_clinicaId_fkey" FOREIGN KEY ("clinicaId") REFERENCES "public"."clinicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."planos_tratamento" ADD CONSTRAINT "planos_tratamento_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."planos_tratamento_procedimentos" ADD CONSTRAINT "planos_tratamento_procedimentos_planoTratamentoId_fkey" FOREIGN KEY ("planoTratamentoId") REFERENCES "public"."planos_tratamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."planos_tratamento_procedimentos" ADD CONSTRAINT "planos_tratamento_procedimentos_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "public"."procedimentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agendamentos" ADD CONSTRAINT "agendamentos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "public"."pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agendamentos" ADD CONSTRAINT "agendamentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "public"."usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agendamentos" ADD CONSTRAINT "agendamentos_tipoAgendamentoId_fkey" FOREIGN KEY ("tipoAgendamentoId") REFERENCES "public"."tipos_agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agendamentos" ADD CONSTRAINT "agendamentos_planoTratamentoId_fkey" FOREIGN KEY ("planoTratamentoId") REFERENCES "public"."planos_tratamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfissionalEspecialidades" ADD CONSTRAINT "_ProfissionalEspecialidades_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."especialidades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ProfissionalEspecialidades" ADD CONSTRAINT "_ProfissionalEspecialidades_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
