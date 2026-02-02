// src/controllers/paymentInstallment.controller.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { PaymentInstallmentService } from "../services/paymentInstallment.service";
import { registerPaymentSchema } from "../schemas/paymentInstallment.schema";
import { PaymentStatus } from "@prisma/client";
import { z } from "zod";

export class PaymentInstallmentController {
  static async registerPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request;
      const { id } = request.params as { id: string };

      // Validação do Zod
      const data = registerPaymentSchema.parse(request.body);

      const installment = await PaymentInstallmentService.registerPayment(
        id,
        clinicId,
        data
      );

      return reply.send(installment);
    } catch (error: any) {
      // 1. Erro de registro não encontrado (Prisma)
      if (error.code === "P2025") {
        return reply.status(404).send({
          message: "Parcela não encontrada ou inválida para pagamento.",
        });
      }

      // 2. Erro de Validação dos dados (Zod)
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          message: "Dados inválidos.",
          errors: error.flatten().fieldErrors, // Retorna detalhes do que está errado
        });
      }

      // 3. ERROS DE REGRA DE NEGÓCIO (Aqui entram: Caixa Fechado, Parcela Paga, etc.)
      // Como seu service faz "throw new Error", o código cai aqui.
      // Retornamos 400 (Bad Request) para o front exibir o toast.
      return reply.status(400).send({
        message: error.message || "Erro inesperado ao processar pagamento.",
      });
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const {
      page = "1",
      pageSize = "10",
      status,
      dueDateStart,
      dueDateEnd,
      patientName,
      treatmentPlanId,
    } = request.query as {
      page?: string;
      pageSize?: string;
      status?: string | string[];
      dueDateStart?: string;
      dueDateEnd?: string;
      patientName?: string;
      treatmentPlanId?: string;
    };

    // Converte 'status' para array se vier como string
    let statusArray: PaymentStatus[] | undefined = undefined;
    if (status) {
      const rawStatuses = Array.isArray(status) ? status : [status];
      statusArray = rawStatuses.filter((s) =>
        Object.values(PaymentStatus).includes(s as PaymentStatus)
      ) as PaymentStatus[];
    }

    const result = await PaymentInstallmentService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      {
        status: statusArray,
        dueDateStart,
        dueDateEnd,
        patientName,
        treatmentPlanId,
      }
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const installment = await PaymentInstallmentService.getById(id, clinicId);
    if (!installment) {
      return reply.status(404).send({ message: "Parcela não encontrada." });
    }
    return reply.send(installment);
  }
}
