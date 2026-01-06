// src/controllers/report.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  accountsPayableReportQuerySchema,
  accountsReceivableReportQuerySchema,
  appointmentsReportQuerySchema,
  attendedPatientsReportQuerySchema,
  cashStatementReportQuerySchema,
  commissionReportQuerySchema,
  expiredProductsReportQuerySchema,
  inactivePatientsReportQuerySchema,
  paymentMethodsReportQuerySchema,
  professionalValueReportQuerySchema,
  salesReportQuerySchema,
  stockAvailabilityReportQuerySchema,
  stockMovementReportQuerySchema,
} from "../schemas/report.schema";
import { ReportService } from "../services/report.service";
import { z } from "zod";

export class ReportController {
  static async generateAppointmentsReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // Validar os query params
      const query = appointmentsReportQuerySchema.parse(request.query);
      const { clinicId } = request;

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

  static async generateProfessionalValueReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // 1. Validar os query params
      const query = professionalValueReportQuerySchema.parse(request.query);
      const { clinicId } = request;

      // 2. Chamar o service para gerar o PDF
      const pdfBuffer = await ReportService.generateProfessionalValueReport(
        clinicId,
        query
      );

      // 3. Enviar o PDF para o cliente
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_valor_profissional.pdf"'
      );

      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateCommissionReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // 1. Validar os query params
      const query = commissionReportQuerySchema.parse(request.query);
      const { clinicId } = request;

      // 2. Chamar o service para gerar o PDF
      const pdfBuffer = await ReportService.generateCommissionReport(
        clinicId,
        query
      );

      // 3. Enviar o PDF para o cliente
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_comissao_vendedor.pdf"'
      );

      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório de comissão:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateAttendedPatientsReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // 1. Validar os query params
      const query = attendedPatientsReportQuerySchema.parse(request.query);
      const { clinicId } = request;

      // 2. Chamar o service para gerar o PDF
      const pdfBuffer = await ReportService.generateAttendedPatientsReport(
        clinicId,
        query
      );

      // 3. Enviar o PDF para o cliente
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_pacientes_atendidos.pdf"'
      );

      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório de pacientes atendidos:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateAccountsReceivableReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = accountsReceivableReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generateAccountsReceivableReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_contas_a_receber.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório a receber:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateAccountsPayableReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = accountsPayableReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generateAccountsPayableReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_contas_a_pagar.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório a pagar:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateStockAvailabilityReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = stockAvailabilityReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generateStockAvailabilityReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_disponibilidade_estoque.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório de estoque:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateStockMovementReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = stockMovementReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generateStockMovementReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_movimentacao_estoque.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório de movimentação:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateSalesReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = salesReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generateSalesReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_vendas.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório de vendas:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generatePaymentMethodsReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = paymentMethodsReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generatePaymentMethodsReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_formas_pagamento.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório de formas de pagamento:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateInactivePatientsReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = inactivePatientsReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generateInactivePatientsReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_pacientes_inativos.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar relatório de inativos:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateCashStatementReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const query = cashStatementReportQuerySchema.parse(request.query);
      const { clinicId } = request;
      const pdfBuffer = await ReportService.generateCashStatementReport(
        clinicId,
        query
      );
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        'inline; filename="relatorio_extrato_caixa.pdf"'
      );
      return reply.send(pdfBuffer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Erro de validação nos filtros.",
          issues: error.format(),
        });
      }
      console.error("Erro ao gerar extrato de caixa:", error);
      return reply
        .status(500)
        .send({ message: "Erro interno ao gerar relatório." });
    }
  }

  static async generateExpiredProductsReport(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const query = expiredProductsReportQuerySchema.parse(request.query);
    const pdf = await ReportService.generateExpiredProductsReport(
      request.clinicId,
      query
    );
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", 'inline; filename="vencidos.pdf"');
    return reply.send(pdf);
  }
}
