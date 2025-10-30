import { FastifyRequest, FastifyReply } from "fastify";
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountParamsSchema,
  listBankAccountQuerySchema,
} from "../schemas/bankAccount.schema";
import { BankAccountService } from "../services/bankAccount.service";

export class BankAccountController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createBankAccountSchema.parse(request.body);
    const bankAccount = await BankAccountService.create(clinicId, data);
    return reply.status(201).send(bankAccount);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { page, pageSize, name } = listBankAccountQuerySchema.parse(
      request.query
    );

    const result = await BankAccountService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = bankAccountParamsSchema.parse(request.params);
    const bankAccount = await BankAccountService.getById(id, clinicId);
    return reply.send(bankAccount);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = bankAccountParamsSchema.parse(request.params);
    const data = updateBankAccountSchema.parse(request.body);

    const bankAccount = await BankAccountService.update(id, clinicId, data);
    return reply.send(bankAccount);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = bankAccountParamsSchema.parse(request.params);

    try {
      await BankAccountService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "ACCOUNT_IN_USE") {
        return reply.status(409).send({
          message:
            "Esta conta não pode ser excluída pois possui transações ou sessões de caixa vinculadas.",
        });
      }
      throw error;
    }
  }
}
