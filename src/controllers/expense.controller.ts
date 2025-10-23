import { FastifyRequest, FastifyReply } from "fastify";
import { ExpenseService } from "../services/expense.service";
import {
  createExpenseSchema,
  updateExpenseSchema,
  markExpenseAsPaidSchema,
} from "../schemas/expense.schema";
import { PaymentStatus } from "@prisma/client";

export class ExpenseController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createExpenseSchema.parse(request.body);
    const expense = await ExpenseService.create(data, clinicId);
    return reply.status(201).send(expense);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const {
      page = "1",
      pageSize = "10",
      status,
      dueDateStart,
      dueDateEnd,
      categoryId,
      supplierId,
    } = request.query as {
      page?: string;
      pageSize?: string;
      status?: string | string[];
      dueDateStart?: string;
      dueDateEnd?: string;
      categoryId?: string;
      supplierId?: string;
    };

    let statusArray: PaymentStatus[] | undefined = undefined;
    if (status) {
      const rawStatuses = Array.isArray(status) ? status : [status];
      statusArray = rawStatuses.filter((s) =>
        Object.values(PaymentStatus).includes(s as PaymentStatus)
      ) as PaymentStatus[];
    }

    const result = await ExpenseService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      { status: statusArray, dueDateStart, dueDateEnd, categoryId, supplierId }
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const expense = await ExpenseService.getById(id, clinicId);
    if (!expense) {
      return reply.status(404).send({ message: "Despesa não encontrada." });
    }
    return reply.send(expense);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const data = updateExpenseSchema.parse(request.body);
    const expense = await ExpenseService.update(id, clinicId, data);
    return reply.send(expense);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    await ExpenseService.delete(id, clinicId);
    return reply.status(204).send();
  }

  static async markAsPaid(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = markExpenseAsPaidSchema.parse(request.body);
      const expense = await ExpenseService.markAsPaid(id, clinicId, data);
      return reply.send(expense);
    } catch (error: any) {
      if (error.code === "P2025") {
        return reply.status(404).send({
          message: "Despesa não encontrada ou inválida para pagamento.",
        });
      }
      throw error;
    }
  }
}
