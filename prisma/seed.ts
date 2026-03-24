// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// async function main() {
//   const STORAGE_100GB =
//     BigInt(100) * BigInt(1024) * BigInt(1024) * BigInt(1024);
//   const EXPIRATION_DATE = new Date("2200-01-01T00:00:00Z");

//   // IDs das suas contas existentes (conforme seu JSON)
//   const TARGET_ACCOUNTS = [
//     "1f4b837a-c051-43a0-b8a9-7bd432f97104",
//     "237d0e65-d920-4441-acdd-95fcff500575",
//   ];

//   // ID do Plano Experts Anual (conforme seu JSON de subscribe-plans)
//   const EXPERTS_PLAN_ID = "9a385fb6-9b27-4bbf-b9ba-5aa65ec4f06f";

//   console.log("🚀 Iniciando migração das contas master...");

//   for (const accountId of TARGET_ACCOUNTS) {
//     console.log(`Configurando conta: ${accountId}`);

//     await prisma.subscription.upsert({
//       where: { accountId: accountId },
//       update: {
//         planId: EXPERTS_PLAN_ID,
//         status: "active",
//         currentPeriodStart: new Date(),
//         currentPeriodEnd: EXPIRATION_DATE,
//         currentMaxUsers: 999, // Liberdade total de usuários
//         currentMaxStorage: STORAGE_100GB, // 100GB de espaço
//         // Ativando absolutamente todas as features
//         activeCrm: true,
//         activeAi: true,
//         activeApp: true,
//         activeFunnel: true,
//         activeWhats: true,
//       },
//       create: {
//         accountId: accountId,
//         planId: EXPERTS_PLAN_ID,
//         status: "active",
//         currentPeriodStart: new Date(),
//         currentPeriodEnd: EXPIRATION_DATE,
//         currentMaxUsers: 999,
//         currentMaxStorage: STORAGE_100GB,
//         activeCrm: true,
//         activeAi: true,
//         activeApp: true,
//         activeFunnel: true,
//         activeWhats: true,
//       },
//     });

//     console.log(
//       `✅ Conta ${accountId} atualizada com sucesso (Válida até 2200).`
//     );
//   }

//   console.log("\n✨ Processo finalizado. Suas contas agora são 'VIPS'.");
// }

// main()
//   .catch((e) => {
//     console.error("❌ Erro ao rodar o seed:");
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });

import { PrismaClient, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Iniciando criação de Templates Globais...");

  const globalTemplates = [
    {
      name: "Depilação a Laser / Luz Pulsada",
      description:
        "Foco obrigatório em fotossensibilidade e riscos de queimadura.",
      professionalType: "ESTETICISTA", // ou LASERTERAPEUTA se você tiver
      category: "LASER",
      isGlobal: true,
      sections: [
        {
          title: "Contraindicações e Riscos",
          order: 0,
          questions: [
            {
              question:
                "Fez uso de Roacutan (Isotretinoína) nos últimos 6 meses?",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question:
                "Tomou antibiótico, corticoide ou anti-inflamatório nos últimos 7 dias? (Alguns causam fotossensibilidade)",
              type: "YES_NO",
              order: 1,
              isRequired: true,
            },
            {
              question: "Tomou sol na área a ser tratada nos últimos 15 dias?",
              type: "YES_NO",
              order: 2,
              isRequired: true,
            },
            {
              question:
                "Possui tatuagem ou micropigmentação na área que será depilada?",
              type: "YES_NO",
              order: 3,
              isRequired: true,
            },
            {
              question: "Possui Vitiligo, Psoríase ou Lúpus?",
              type: "YES_NO",
              order: 4,
              isRequired: true,
            },
          ],
        },
        {
          title: "Características da Área",
          order: 1,
          questions: [
            {
              question: "Utilizou cera ou pinça na região nos últimos 30 dias?",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question: "Qual o método de depilação mais utilizado atualmente?",
              type: "SINGLE_SELECT",
              options: [
                "Lâmina",
                "Cera",
                "Creme Depilatório",
                "Pinça",
                "Máquina Elétrica",
              ],
              order: 1,
              isRequired: true,
            },
          ],
        },
      ],
    },
    {
      name: "Micropigmentação (Sobrancelhas e Lábios)",
      description:
        "Avaliação de cicatrização, diabetes e pigmentos anteriores.",
      professionalType: "ESTETICISTA", // ou MICROPIGMENTADORA
      category: "FACIAL",
      isGlobal: true,
      sections: [
        {
          title: "Saúde e Cicatrização",
          order: 0,
          questions: [
            {
              question:
                "É portador(a) de Diabetes? (Interfere na cicatrização e fixação do pigmento)",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question:
                "Possui histórico de Queloides ou dificuldade de cicatrização?",
              type: "YES_NO",
              order: 1,
              isRequired: true,
            },
            {
              question:
                "Apresenta alergia a cosméticos, tintas ou anestésicos locais?",
              type: "SHORT_TEXT",
              order: 2,
              isRequired: false,
            },
            {
              question:
                "Faz uso de medicamentos anticoagulantes (AAS, Aspirina)?",
              type: "YES_NO",
              order: 3,
              isRequired: true,
            },
          ],
        },
        {
          title: "Histórico da Região",
          order: 1,
          questions: [
            {
              question: "Já possui micropigmentação anterior na região?",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question:
                "Se sim, a cor atual está alterada? (Azulada, avermelhada, acinzentada)",
              type: "SHORT_TEXT",
              order: 1,
              isRequired: false,
            },
            {
              question: "Utiliza ácidos na região da testa ou sobrancelha?",
              type: "YES_NO",
              order: 2,
              isRequired: true,
            },
          ],
        },
      ],
    },
    {
      name: "Estética Corporal (Enzimas e Criolipólise)",
      description:
        "Anamnese focada em metabolismo, implantes metálicos e gordura localizada.",
      professionalType: "ESTETICISTA", // ou BIOMEDICO
      category: "CORPORAL",
      isGlobal: true,
      sections: [
        {
          title: "Metabolismo e Hábitos",
          order: 0,
          questions: [
            {
              question: "Pratica atividade física regularmente?",
              type: "SINGLE_SELECT",
              options: [
                "Não pratico",
                "1 a 2x na semana",
                "3 a 5x na semana",
                "Todos os dias",
              ],
              order: 0,
              isRequired: true,
            },
            {
              question: "Como é o funcionamento do seu intestino?",
              type: "SINGLE_SELECT",
              options: [
                "Regular (Todos os dias)",
                "Irregular (A cada 2 ou 3 dias)",
                "Preso (Mais de 3 dias)",
              ],
              order: 1,
              isRequired: true,
            },
            {
              question:
                "Qual a sua média de ingestão de água diária (em litros)?",
              type: "SCALE",
              order: 2,
              isRequired: true,
            },
            {
              question:
                "Possui problemas de tireoide (Hipotireoidismo/Hipertireoidismo)?",
              type: "YES_NO",
              order: 3,
              isRequired: true,
            },
          ],
        },
        {
          title: "Contraindicações Físicas",
          order: 1,
          questions: [
            {
              question:
                "Possui marcapasso, DIU de cobre ou placas metálicas no corpo? (Contraindicação para Radiofrequência)",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question:
                "Possui hérnia na região a ser tratada (umbilical, inguinal)?",
              type: "YES_NO",
              order: 1,
              isRequired: true,
            },
            {
              question:
                "Tem alergia a frutos do mar? (Importante para algumas enzimas lipolíticas)",
              type: "YES_NO",
              order: 2,
              isRequired: true,
            },
          ],
        },
      ],
    },
    {
      name: "Peeling Químico e Microagulhamento",
      description: "Foco em fototipos, manchas, melasma e cuidados home care.",
      professionalType: "ESTETICISTA",
      category: "FACIAL",
      isGlobal: true,
      sections: [
        {
          title: "Análise de Pele e Sensibilidade",
          order: 0,
          questions: [
            {
              question: "Possui histórico clínico de Melasma?",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question:
                "Tem tendência a desenvolver manchas escuras após machucados ou espinhas?",
              type: "YES_NO",
              order: 1,
              isRequired: true,
            },
            {
              question: "Qual o seu Fototipo (Cor da pele e reação ao sol)?",
              type: "SINGLE_SELECT",
              options: [
                "I e II - Branca (Queima, não bronzeia)",
                "III - Morena clara (Queima pouco, bronzeia)",
                "IV e V - Morena escura/Negra (Não queima, bronzeia muito)",
              ],
              order: 2,
              isRequired: true,
            },
            {
              question: "Apresenta episódios de Herpes Labial frequente?",
              type: "YES_NO",
              order: 3,
              isRequired: true,
            },
          ],
        },
        {
          title: "Cuidados Diários (Home Care)",
          order: 1,
          questions: [
            {
              question:
                "Faz uso de ácidos em casa (Glicólico, Retinoico, Salicílico)?",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question:
                "Usa protetor solar diariamente, mesmo em locais fechados?",
              type: "YES_NO",
              order: 1,
              isRequired: true,
            },
            {
              question:
                "Pretende se expor ao sol forte (praia/piscina) nos próximos 15 dias?",
              type: "YES_NO",
              order: 2,
              isRequired: true,
            },
          ],
        },
      ],
    },
    {
      name: "Injetáveis Base (Botox e Preenchimento)",
      description:
        "Anamnese padrão para Harmonização Facial e risco de intercorrências.",
      professionalType: "BIOMEDICO",
      category: "INJETAVEIS",
      isGlobal: true,
      sections: [
        {
          title: "Histórico Clínico",
          order: 0,
          questions: [
            {
              question:
                "Possui doença autoimune (Lúpus, Vitiligo, Artrite Reumatoide)?",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question: "É gestante ou lactante?",
              type: "YES_NO",
              order: 1,
              isRequired: true,
            },
            {
              question:
                "Apresenta alergia a anestésicos locais ou toxina botulínica?",
              type: "YES_NO",
              order: 2,
              isRequired: true,
            },
            {
              question: "Fez uso de Roacutan nos últimos 6 meses?",
              type: "YES_NO",
              order: 3,
              isRequired: true,
            },
          ],
        },
        {
          title: "Procedimentos Anteriores",
          order: 1,
          questions: [
            {
              question:
                "Já realizou algum preenchimento definitivo (PMMA/Silicone) na face?",
              type: "YES_NO",
              order: 0,
              isRequired: true,
            },
            {
              question:
                "Quando foi a última aplicação de Botox ou Ácido Hialurônico?",
              type: "SINGLE_SELECT",
              options: [
                "Nunca fiz",
                "Há menos de 3 meses",
                "Entre 3 e 6 meses",
                "Há mais de 6 meses",
              ],
              order: 1,
              isRequired: true,
            },
            {
              question:
                "Tem histórico de choque anafilático ou alergias graves?",
              type: "YES_NO",
              order: 2,
              isRequired: true,
            },
          ],
        },
      ],
    },
  ];

  for (const t of globalTemplates) {
    // Usamos upsert para não duplicar se rodar o seed 2x
    await prisma.anamnesisTemplate.upsert({
      where: { id: `global-${t.category?.toLowerCase()}` }, // ID fixo para o seed
      update: {},
      create: {
        id: `global-${t.category?.toLowerCase()}`,
        name: t.name,
        description: t.description,
        professionalType: t.professionalType,
        category: t.category,
        isGlobal: true,
        sections: {
          create: t.sections.map((s) => ({
            title: s.title,
            order: s.order,
            questions: {
              create: s.questions.map((q) => ({
                question: q.question,
                type: q.type as QuestionType,
                options: q.options || [],
                order: q.order,
                isRequired: q.isRequired,
              })),
            },
          })),
        },
      },
    });
  }

  console.log("✨ Templates Globais injetados com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
