import { FastifyRequest, FastifyReply } from "fastify";
import {
  createProductCategorySchema,
  updateProductCategorySchema,
} from "../schemas/productCategory.schema";
import { ProductCategoryService } from "../services/productCategory.service";

export class ProductCategoryController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request;
      const data = createProductCategorySchema.parse(request.body);

      const category = await ProductCategoryService.create(data, clinicId);
      return reply.status(201).send(category);
    } catch (error: any) {
      // Trata erro de nome duplicado (definido no @@unique do schema)
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
    const {
      page = "1",
      pageSize = "10",
      name,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
    };

    const result = await ProductCategoryService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    const category = await ProductCategoryService.getById(id, clinicId);

    if (!category) {
      return reply.status(404).send({ message: "Categoria não encontrada." });
    }
    return reply.send(category);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updateProductCategorySchema.parse(request.body);

    const category = await ProductCategoryService.update(id, data, clinicId);
    return reply.send(category);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    try {
      await ProductCategoryService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      // Trata a regra de negócio do serviço
      if (error.message === "CATEGORY_IN_USE") {
        return reply.status(409).send({
          message:
            "Esta categoria não pode ser excluída pois está sendo utilizada por um ou mais produtos.",
        });
      }
      throw error;
    }
  }
}
