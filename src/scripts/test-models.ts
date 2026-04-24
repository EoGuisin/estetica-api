import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function listarModelos() {
  // Faz uma chamada para a API pedindo os modelos disponíveis
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  );
  const data = await response.json();

  console.log("Modelos Disponíveis na sua API:");
  data.models.forEach((modelo: any) => {
    console.log(`- Nome: ${modelo.name.replace("models/", "")}`);
    console.log(`  Descrição: ${modelo.description}`);
    console.log(
      `  Métodos suportados: ${modelo.supportedGenerationMethods.join(", ")}\n`
    );
  });
}

listarModelos();
