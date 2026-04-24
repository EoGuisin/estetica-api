import { prisma } from "../lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Inicializa o SDK com a sua chave (coloque no .env)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class AiService {
  static async answerQuestion(question: string) {
    try {
      // 1. Gera o Embedding (vetor) da pergunta do usuário
      const embeddingModel = genAI.getGenerativeModel({
        model: "gemini-embedding-001",
      });
      const embeddingResult = await embeddingModel.embedContent(question);
      const queryVector = embeddingResult.embedding.values.slice(0, 768);

      // 2. Busca no PostgreSQL os 3 manuais mais relevantes
      const relevantDocs = await prisma.$queryRaw<
        Array<{ title: string; content: string }>
      >`
        SELECT title, content
        FROM "knowledge_articles"
        ORDER BY embedding <-> ${queryVector}::vector
        LIMIT 3;
      `;

      // 3. Monta o Contexto (RAG)
      const context = relevantDocs
        .map((doc) => `--- ${doc.title} ---\n${doc.content}`)
        .join("\n\n");

      // 4. Monta o Prompt para o Gemini (ATUALIZADO)
      const prompt = `
            Você é a Assistente Virtual Oficial de Suporte do BellFlow, um sistema de gestão para clínicas de estética.

            REGRAS DE FORMATAÇÃO E LINGUAGEM (MUITO IMPORTANTE):
            1. Use formatação Markdown básica (como **negrito**) para destacar termos importantes e facilitar a leitura.
            2. NUNCA mencione termos técnicos do sistema, variáveis, ou "enums" do banco de dados. 
            3. Traduza qualquer termo técnico do manual para a linguagem amigável do usuário final (ex: em vez de ON_SALE, diga apenas "Na Venda").

            REGRAS DE ATENDIMENTO:
            1. Seja empática, direta e profissional.
            2. Se a pergunta do usuário for muito curta, vaga ou ambígua (ex: "como configuro?"), NÃO responda com frases robóticas. Seja proativa: tente deduzir o que ele quer ou dê opções claras do que pode ser feito no sistema.

            Com base nas seguintes documentações do sistema BellFlow:
            """
            ${context}
            """

            Responda à pergunta do usuário:
            "${question}"
        `;

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);

      return result.response.text();
    } catch (error) {
      console.error("Erro no AiService:", error);
      throw new Error("Não foi possível processar a pergunta neste momento.");
    }
  }

  // Corrigido para o modelo novo e com o corte de 768!
  static async createKnowledgeArticle(title: string, content: string) {
    const embeddingModel = genAI.getGenerativeModel({
      model: "gemini-embedding-001",
    });
    const embeddingResult = await embeddingModel.embedContent(content);
    const vector = embeddingResult.embedding.values.slice(0, 768);

    await prisma.$executeRaw`
      INSERT INTO "knowledge_articles" (id, title, content, embedding, "updatedAt")
      VALUES (gen_random_uuid(), ${title}, ${content}, ${vector}::vector, NOW());
    `;

    return { success: true };
  }
}
