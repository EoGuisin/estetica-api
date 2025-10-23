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
      // Tratar erros como 'Parcela não encontrada ou já paga'
      if (error.code === 'P2025') { // Prisma's RecordNotFound error
         return reply.status(404).send({ message: "Parcela não encontrada ou inválida para pagamento." });
      }
      // Outros erros específicos do serviço poderiam ser tratados aqui
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      status, // Recebe como string ou array de strings
      dueDateStart,
      dueDateEnd,
      patientId,
      treatmentPlanId
    } = request.query as {
      page?: string;
      pageSize?: string;
      status?: string | string[];
      dueDateStart?: string;
      dueDateEnd?: string;
      patientId?: string;
      treatmentPlanId?: string;
    };

    // Converte 'status' para array se vier como string
    let statusArray: PaymentStatus[] | undefined = undefined;
    if (status) {
       const rawStatuses = Array.isArray(status) ? status : [status];
       statusArray = rawStatuses.filter(s => Object.values(PaymentStatus).includes(s as PaymentStatus)) as PaymentStatus[];
    }


    const result = await PaymentInstallmentService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { 
        status: statusArray, 
        dueDateStart, 
        dueDateEnd, 
        patientId,
        treatmentPlanId
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