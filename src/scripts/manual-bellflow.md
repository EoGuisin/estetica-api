# Manual Mestre de Operação e Referência Técnica: Sistema BellFlow

**Versão:** 4.3 (Edição Definitiva Expandida para LLM)
**Data de Atualização:** 24 de Abril de 2026
**Propósito:** Documentação exaustiva das funcionalidades, fluxos de dados, amarrações de banco de dados e regras de negócio do sistema BellFlow para treinamento de usuários e alimentação da IA Assistente.

---

## 1. Arquitetura do Sistema, Licenças e Acesso

O BellFlow é um ecossistema B2B Multi-tenant. Cada conta (Account) possui uma Assinatura (Subscription) que dita os limites operacionais das clínicas vinculadas.

### 1.1. Gestão de Licenças e Assinaturas

- **Limites Ativos:** O sistema bloqueia a criação de novos usuários caso a clínica atinja o limite contratado (`currentMaxUsers`). A clínica precisará fazer upgrade do plano.
- **Feature Flags:** O acesso a módulos como CRM, IA, Funil e WhatsApp é validado pela assinatura ativa.

---

## 2. Configurações Globais da Clínica e Profissionais

O comportamento do sistema é ditado por regras estritas configuradas pelo Administrador.

### 2.1. Regras de Funcionamento da Clínica

- **Horários Base:** A clínica define um `openingHour` e `closingHour`. O sistema **impede** a alteração desses horários se já existirem agendamentos futuros marcados fora da nova grade proposta.
- **Agendamentos Simultâneos:** É possível configurar se a clínica aceita ou não cruzamento de horários (`allowParallelAppointments`) e qual o limite máximo de pacientes no mesmo horário (`parallelAppointmentsLimit`).

### 2.2. Perfis de Profissionais e Usuários

- **Jornada de Trabalho:** Cada profissional tem dias úteis definidos (`workingDays`) e um horário próprio (`scheduleStartHour` e `scheduleEndHour`), que **nunca** pode exceder o horário de funcionamento global da clínica.
- **Assinatura Digital:** Profissionais podem fazer upload de uma imagem de assinatura (`signatureImagePath`) que será usada em receituários, laudos e atestados.

---

## 3. Especialidades e Documentação Legal (Termos e Contratos)

O sistema possui gestão documental com validade jurídica, atrelada às especialidades médicas/estéticas.

- **Especialidades:** Agrupam procedimentos e profissionais.
- **Templates Jurídicos:** É possível criar modelos de documentos (`SpecialtyTemplate`) divididos em:
  - `TERM`: Termos de Consentimento Livre e Esclarecido (LGPD, riscos do procedimento).
  - `CONTRACT`: Contratos de Prestação de Serviço financeiro.
- **Assinatura de Pacientes:** Quando um paciente assina um documento (`PatientDocument`), o sistema registra a data, captura o IP (`ipAddress`), o navegador (`userAgent`) e gera um Hash criptográfico (`documentHash`) para provar a integridade legal do PDF.

---

## 4. Agenda Operacional (Interface Central)

A página inicial do BellFlow é uma Agenda Dinâmica de alto desempenho, que centraliza a operação diária da clínica.

### 4.1. Visualização e Bloqueios Inteligentes

- **Visualizações:** O usuário pode alternar a grade entre Dia, Semana e Mês.
- **Filtro de Profissionais:** É possível cruzar agendas selecionando múltiplos profissionais.
- **Bloqueio Visual (Unavailability):** O sistema acinzenta/bloqueia visualmente os horários na agenda se o profissional não trabalhar naquele dia da semana ou se estiver fora do seu horário de expediente (respeitando também o horário da clínica).

### 4.2. Modal de Criação e Tags Visuais

- **Categoria do Agendamento:** \* `Avaliação` ou `Retorno`: Não necessitam de vínculo obrigatório com procedimentos. Aparecem na agenda com as tags visuais **AVAL** ou **RET**.
  - `Sessão`: Exige o vínculo com procedimentos contratados no Plano de Tratamento. Aparece na agenda com a tag **SESSÃO**.
- **Procedimento(s)/Serviço(s):** Permite a inclusão de **múltiplos procedimentos** simultâneos. A `Hora Fim` é calculada dinamicamente somando a duração padrão de todos.
- **Cores de Status (Color-Coding):** O card do agendamento muda de cor conforme o status: Agendado (Cor do profissional), Confirmado (Ciano), Em Atendimento (Azul), Concluído (Verde) e Cancelado (Vermelho).

---

## 5. Prontuário Digital (Painel de Atendimento) e Vendas

O coração clínico da aplicação. Ao iniciar um agendamento, o profissional acessa o Painel de Atendimento Centralizado.

### 5.1. O Painel de Atendimento (Attendance)

A interface de atendimento ao paciente no consultório é dividida estrategicamente para evitar perda de foco:

- **Cabeçalho de Contexto:** Exibe foto, idade e o rastreador de sessões em tempo real (Ex: _Sessão 2/5_). Permite mudar o status do atendimento diretamente (ex: de "Em Atendimento" para "Concluído").
- **Barra de Ações Rápidas:** Botões superiores para anexar exames/arquivos ou gerar/assinar Termos e Contratos na hora.
- **Seções Expansíveis (Collapses):**
  1. **Prontuário Clínico (Evolução):** Onde o profissional insere o diagnóstico e a evolução textual do dia.
  2. **Avaliações (Anamnese):** Lista de formulários preenchidos ou em andamento. Suporta versionamento (preserva anamneses antigas mesmo se o modelo base mudar).
  3. **Histórico do Paciente:** Linha do tempo completa mostrando todos os atendimentos passados, qual profissional atendeu, horários e status.
  4. **Antes e Depois:** Galeria interativa de imagens comparativas com marcação de data e descrição.

### 5.2. Fluxo Comercial: Orçamento vs. Venda (Planos de Tratamento)

A jornada financeira ocorre através dos Planos de Tratamento (`TreatmentPlan`).

- **Fase 1 - Orçamento (Draft):** O plano é um rascunho. Não gera parcelas e não bloqueia estoque.
- **Fase 2 - Venda Aprovada (Approved):** Quando o paciente aprova:
  1. Trava o plano (proíbe alterar procedimentos).
  2. Gera automaticamente as parcelas no módulo financeiro (ex: entrada + 3x).
- **Trava de Segurança (Exclusão):** O sistema **PROÍBE** a exclusão de um Plano de Tratamento se ele já possuir qualquer parcela paga (`PaymentStatus.PAID`), comissão paga, ou sessão realizada. Nesses casos, usa-se o "Cancelamento".

---

## 6. Gestão Financeira, Caixas e Comissões

O BellFlow é um ERP financeiro completo.

### 6.1. Controle de Caixa Avançado (`CashRegisterSession`)

- O sistema exige a abertura de um Caixa para transações em espécie/físicas.
- No momento do fechamento, o operador informa o saldo gaveta (`observedClosing`). O sistema compara com o saldo computado (`closingBalance`) e registra permanentemente qualquer discrepância.

### 6.2. Regras de Gatilhos de Comissão

A comissão do profissional é gerada com base em 4 engrenagens possíveis (`CommissionTriggerEvent`):

- `Na Venda (ON_SALE)`: Comissão gerada assim que o Plano é Aprovado, mesmo sem o paciente ter pago.
- `No 1º Pagamento da Parcela (ON_FIRST_INSTALLMENT_PAID)`: Comissão total liberada na 1ª parcela paga.
- `Na Quitação Total do Plano (ON_FULL_PLAN_PAID)`: Comissão retida até que 100% das parcelas estejam pagas.
- `A Cada Parcela Quitada (ON_EACH_INSTALLMENT_PAID)`: O profissional recebe comissões fracionadas proporcionalmente ao pagamento das parcelas.

---

## 7. Suporte e Central de Ajuda

- **Painel Kanban:** Clínicas abrem chamados (`Tickets`) classificados como Dúvida, Bug, Financeiro ou Sugestão.
- **Comunicação Interna:** A equipe BellFlow pode adicionar "Notas Internas" invisíveis ao cliente.
- **IA Assistente:** IA integrada ao painel para sanar dúvidas instantâneas operacionais com base nesta base de conhecimento.

---

**Nota Crítica para LLM:** 1. Ao orientar sobre a tela de Atendimento, informe que o profissional encontra TUDO centralizado nos "collapses" (Histórico, Anamnese, Fotos, Evolução) e na barra de ações rápidas. 2. Ao orientar exclusões de Vendas, lembre-se da trava de segurança do `TreatmentPlan`: Vendas com parcelas pagas ou sessões executadas NÃO podem ser excluídas, apenas canceladas. 3. Lembre o usuário que a agenda bloqueia visualmente (fica cinza) dias ou horários em que o profissional não atende.
