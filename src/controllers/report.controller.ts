// src/controllers/report.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { appointmentsReportQuerySchema } from "../schemas/report.schema";
import { ReportService } from "../services/report.service";
import { z } from "zod"; // <--- ADICIONADO AQUI

export class ReportController {
  static async generateAppointmentsReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // Validar os query params
      const query = appointmentsReportQuerySchema.parse(request.query);
      const { clinicId } = request.user;

      // Chamar o service para gerar o PDF
      const pdfBuffer = await ReportService.generateAppointmentsReport(
        clinicId,
        query
      );

      // Enviar o PDF para o cliente
      reply.header("Content-Type", "application/pdf");
      // 'inline' tenta abrir no navegador, 'attachment' força o download
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_atendimentos.pdf"'
      );

      return reply.send(pdfBuffer);
    } catch (error) {
      // Tratar erros (incluindo erros de validação Zod)
      if (error instanceof z.ZodError) {
        // <--- Agora 'z' é reconhecido
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório:", error); // <--- E 'error' não será mais 'unknown' aqui
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }
}
