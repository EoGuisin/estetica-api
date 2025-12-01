import { FastifyRequest, FastifyReply } from "fastify";
import { ExpenseCategoryService } from "../services/expenseCategory.service";
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
} from "../schemas/expenseCategory.schema";

export class ExpenseCategoryController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request;
      const data = createExpenseCategorySchema.parse(request.body);
      const category = await ExpenseCategoryService.create(data, clinicId);
      return reply.status(201).send(category);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Uma categoria com este nome já existe." });
      }
      throw error;
    }
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { name } = request.query as { name?: string };
    const categories = await ExpenseCategoryService.list(clinicId, name);
    // Para consistência com outras listagens, retornamos um objeto { data: ..., totalCount: ... }
    // Embora não haja paginação aqui, facilita o frontend.
    return reply.send({ data: categories, totalCount: categories.length });
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const category = await ExpenseCategoryService.getById(id, clinicId);
    if (!category) {
      return reply.status(404).send({ message: "Categoria não encontrada." });
    }
    return reply.send(category);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updateExpenseCategorySchema.parse(request.body);
    const category = await ExpenseCategoryService.update(id, clinicId, data);
    return reply.send(category);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    try {
      await ExpenseCategoryService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "CATEGORY_IN_USE") {
        return reply.status(409).send({
          message: "Categoria em uso por despesas, não pode ser excluída.",
        });
      }
      throw error;
    }
  }
}
