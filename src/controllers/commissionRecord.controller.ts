import { FastifyRequest, FastifyReply } from "fastify";
import { CommissionRecordService } from "../services/commissionRecord.service";
import { markCommissionAsPaidSchema } from "../schemas/commissionRecord.schema";
import { CommissionStatus } from "@prisma/client";

export class CommissionRecordController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      professionalId,
      status,
      dateStart,
      dateEnd,
    } = request.query as {
      page?: string;
      pageSize?: string;
      professionalId?: string;
      status?: CommissionStatus;
      dateStart?: string;
      dateEnd?: string;
    };

    // Valida o status se fornecido
    const validStatus =
      status && Object.values(CommissionStatus).includes(status)
        ? status
        : undefined;

    const result = await CommissionRecordService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { professionalId, status: validStatus, dateStart, dateEnd }
    );
    return reply.send(result);
  }

  static async markAsPaid(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = markCommissionAsPaidSchema.parse(request.body);

      const record = await CommissionRecordService.markAsPaid(
        id,
        clinicId,
        data
      );
      return reply.send(record);
    } catch (error: any) {
      if (error.code === "P2025") {
        // Prisma RecordNotFound
        return reply
          .status(404)
          .send({ message: "Registro de comissão não encontrado ou já pago." });
      }
      throw error;
    }
  }
}
