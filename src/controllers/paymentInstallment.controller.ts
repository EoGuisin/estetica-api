// src/controllers/paymentInstallment.controller.ts

import { FastifyRequest, FastifyReply } from "fastify";
import { PaymentInstallmentService } from "../services/paymentInstallment.service";
import { registerPaymentSchema } from "../schemas/paymentInstallment.schema";
import { PaymentStatus } from "@prisma/client";

export class PaymentInstallmentController {
  static async registerPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = registerPaymentSchema.parse(request.body);

      const installment = await PaymentInstallmentService.registerPayment(
        id,
        clinicId,
        data
      );
      return reply.send(installment);
    } catch (error: any) {
      if (error.code === "P2025") {
        return reply.status(404).send({
          message: "Parcela não encontrada ou inválida para pagamento.",
        });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
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
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const installment = await PaymentInstallmentService.getById(id, clinicId);
    if (!installment) {
      return reply.status(404).send({ message: "Parcela não encontrada." });
    }
    return reply.send(installment);
  }
}
