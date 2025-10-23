import { FastifyRequest, FastifyReply } from "fastify";
import {
  createProductSchema,
  updateProductSchema,
} from "../schemas/product.schema";
import { ProductService } from "../services/product.service";

export class ProductController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const data = createProductSchema.parse(request.body);

      const product = await ProductService.create(data, clinicId);
      return reply.status(201).send(product);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Um produto com este SKU já existe." });
      }
      // Prisma's findFirstOrThrow throws an error with this code
      if (error.code === "P2025") {
        return reply.status(404).send({
          message:
            "Categoria ou Marca não encontrada. Verifique os dados e tente novamente.",
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
      name,
      sku,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
      sku?: string;
    };

    const result = await ProductService.list(
      clinicId,
      Number(page),
      Number(pageSize),
      name,
      sku
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    const product = await ProductService.getById(id, clinicId);

    if (!product) {
      return reply.status(404).send({ message: "Produto não encontrado." });
    }
    return reply.send(product);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request.user;
      const { id } = request.params as { id: string };
      const data = updateProductSchema.parse(request.body);

      const product = await ProductService.update(id, data, clinicId);
      return reply.send(product);
    } catch (error: any) {
      if (error.code === "P2025") {
        return reply.status(404).send({
          message:
            "Produto, Categoria ou Marca não encontrada. Verifique os dados e tente novamente.",
        });
      }
      throw error;
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };

    try {
      await ProductService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "PRODUCT_IN_USE") {
        return reply.status(409).send({
          message:
            "Este produto não pode ser excluído pois possui um histórico de movimentações no estoque.",
        });
      }

      throw error;
    }
  }
}
