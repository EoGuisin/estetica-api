import { FastifyRequest, FastifyReply } from "fastify";
import {
  createProductBrandSchema,
  updateProductBrandSchema,
} from "../schemas/productBrand.schema";
import { ProductBrandService } from "../services/productBrand.service";

export class ProductBrandController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request;
      const data = createProductBrandSchema.parse(request.body);

      const brand = await ProductBrandService.create(data, clinicId);
      return reply.status(201).send(brand);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Uma marca com este nome já existe." });
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

    const result = await ProductBrandService.list(
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

    const brand = await ProductBrandService.getById(id, clinicId);

    if (!brand) {
      return reply.status(404).send({ message: "Marca não encontrada." });
    }
    return reply.send(brand);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updateProductBrandSchema.parse(request.body);

    const brand = await ProductBrandService.update(id, data, clinicId);
    return reply.send(brand);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    try {
      await ProductBrandService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "BRAND_IN_USE") {
        return reply.status(409).send({
          message:
            "Esta marca não pode ser excluída pois está sendo utilizada por um ou mais produtos.",
        });
      }
      throw error;
    }
  }
}
