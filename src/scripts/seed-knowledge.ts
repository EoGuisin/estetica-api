import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// Inicializa o Prisma e o Gemini
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function seedManual() {
  console.log("🚀 Iniciando o processamento do Manual do BellFlow...");

  // 1. Lê o arquivo Markdown
  const filePath = path.join(__dirname, "manual-bellflow.md");
  const manualText = fs.readFileSync(filePath, "utf-8");

  // 2. Fatiamento (Chunking) inteligente
  // Como seu manual é muito bem estruturado com "## ", vamos dividir por essas seções maiores.
  // Isso garante que o contexto de "Financeiro" não se misture com "Estoque" no mesmo vetor.
  const rawChunks = manualText.split("\n## ");

  const embeddingModel = genAI.getGenerativeModel({
    model: "gemini-embedding-001",
  });

  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i].trim();
    if (!chunk) continue;

    // Recoloca o "## " que foi removido no split (exceto no primeiro bloco, que é a introdução)
    if (i > 0) {
      chunk = "## " + chunk;
    }

    // Tenta extrair o título do bloco (a primeira linha) para salvar bonitinho no banco
    const firstLine = chunk.split("\n")[0].replace("## ", "").trim();
    const title = firstLine.length > 50 ? "Introdução / Geral" : firstLine;

    console.log(`⏳ Vetorizando seção: "${title}"...`);

    try {
      // 3. Gera o vetor (Embedding)
      const embeddingResult = await embeddingModel.embedContent(chunk);
      const vector = embeddingResult.embedding.values.slice(0, 768);

      // 4. Salva no PostgreSQL usando a extensão pgvector via $executeRaw
      await prisma.$executeRaw`
        INSERT INTO "knowledge_articles" (id, title, content, embedding, "updatedAt")
        VALUES (
          gen_random_uuid(), 
          ${title}, 
          ${chunk}, 
          ${vector}::vector, 
          NOW()
        );
      `;

      console.log(`✅ Salvo com sucesso!`);
    } catch (error) {
      console.error(`❌ Erro ao salvar a seção "${title}":`, error);
    }
  }

  console.log(
    "🎉 Processamento concluído! O cérebro do BellFlow está alimentado."
  );
}

// Executa a função
seedManual()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
