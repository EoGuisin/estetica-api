import { FastifyRequest, FastifyReply } from "fastify";
import {
  createCommissionPlanSchema,
  updateCommissionPlanSchema,
} from "../schemas/commission.schema";
import { CommissionPlanService } from "../services/commissionPlan.service";

export class CommissionPlanController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request;
      const data = createCommissionPlanSchema.parse(request.body);

      const plan = await CommissionPlanService.create(data, clinicId);
      return reply.status(201).send(plan);
    } catch (error: any) {
      if (error.code === "P2002") {
        return reply
          .status(409)
          .send({ message: "Um plano de comissão com este nome já existe." });
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

    const result = await CommissionPlanService.list(
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

    const plan = await CommissionPlanService.getById(id, clinicId);

    if (!plan) {
      return reply
        .status(404)
        .send({ message: "Plano de comissão não encontrado." });
    }
    return reply.send(plan);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updateCommissionPlanSchema.parse(request.body);

    const plan = await CommissionPlanService.update(id, data, clinicId);
    return reply.send(plan);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    try {
      await CommissionPlanService.delete(id, clinicId);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.message === "PLAN_IN_USE") {
        return reply.status(409).send({
          message:
            "Este plano não pode ser excluído pois está vinculado a um ou mais profissionais.",
        });
      }
      throw error;
    }
  }
}
