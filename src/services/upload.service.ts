import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Use suas variáveis de ambiente reais aqui
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export class UploadService {
  static async uploadTicketFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string
  ) {
    const fileExt = fileName.split(".").pop();
    // Gera um nome único para não ter conflito no Bucket
    const uniqueName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `anexos/${uniqueName}`; // Salva dentro de uma pastinha 'anexos' no bucket

    const { data, error } = await supabase.storage
      .from("tickets") // Nome do Bucket que você criou
      .upload(filePath, fileBuffer, {
        contentType: contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(
        `Erro ao subir arquivo para o Supabase: ${error.message}`
      );
    }

    // Pega a URL pública
    const { data: publicUrlData } = supabase.storage
      .from("tickets")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }
}
