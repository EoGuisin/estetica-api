// src/services/adminAi.service.ts
import { prisma } from "../lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CreateAiArticleInput } from "../schemas/adminAi.schema";

// Inicializa o SDK do Gemini com a chave do seu .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export class AdminAiService {
  static async listArticles() {
    // Usamos $queryRaw para não trazer a coluna "embedding" que é muito pesada
    // e não serve para nada no frontend, só pro banco de dados
    return prisma.$queryRaw`
      SELECT id, title, "createdAt" 
      FROM "knowledge_articles" 
      ORDER BY "createdAt" DESC;
    `;
  }

  static async createArticle(data: CreateAiArticleInput) {
    // 1. Gera o vetor do conteúdo
    const embeddingModel = genAI.getGenerativeModel({
      model: "gemini-embedding-001",
    });
    const embeddingResult = await embeddingModel.embedContent(data.content);
    const vector = embeddingResult.embedding.values.slice(0, 768);

    // 2. Salva no banco com $executeRaw para lidar corretamente com a tipagem do pgvector
    await prisma.$executeRaw`
      INSERT INTO "knowledge_articles" (id, title, content, embedding, "updatedAt")
      VALUES (
        gen_random_uuid(), 
        ${data.title}, 
        ${data.content}, 
        ${vector}::vector, 
        NOW()
      );
    `;

    return { success: true };
  }

  static async deleteArticle(id: string) {
    // Deleta o artigo do banco
    await prisma.$executeRaw`DELETE FROM "knowledge_articles" WHERE id = ${id}`;
    return { success: true };
  }
}
