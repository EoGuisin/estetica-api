import { FastifyRequest, FastifyReply } from "fastify";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "../schemas/supplier.schema";
import { SupplierService } from "../services/supplier.service";

export class SupplierController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request;
      const data = createSupplierSchema.parse(request.body);

      const supplier = await SupplierService.create(data, clinicId);
      return reply.status(201).send(supplier);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Um fornecedor com este nome já existe." });
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

    const result = await SupplierService.list(
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

    const supplier = await SupplierService.getById(id, clinicId);

    if (!supplier) {
      return reply.status(404).send({ message: "Fornecedor não encontrado." });
    }
    return reply.send(supplier);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updateSupplierSchema.parse(request.body);

    const supplier = await SupplierService.update(id, data, clinicId);
    return reply.send(supplier);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    try {
      await SupplierService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "SUPPLIER_IN_USE") {
        return reply.status(409).send({
          message:
            "Este fornecedor não pode ser excluído pois possui movimentações de estoque registradas.",
        });
      }
      throw error;
    }
  }
}
