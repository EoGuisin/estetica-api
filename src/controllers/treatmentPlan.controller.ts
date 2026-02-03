import { FastifyRequest, FastifyReply } from "fastify";
import { TreatmentPlanService } from "../services/treatmentPlan.service";
import { createTreatmentPlanSchema } from "../schemas/treatmentPlan.schema";

export class TreatmentPlanController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const data = createTreatmentPlanSchema.parse(request.body);
    const plan = await TreatmentPlanService.create(clinicId, data);
    return reply.status(201).send(plan);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const plans = await TreatmentPlanService.list(clinicId);
    return reply.send(plans);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const plan = await TreatmentPlanService.getById(id, clinicId);
    if (!plan) {
      return reply.status(404).send({ message: "Plano não encontrado." });
    }
    return reply.send(plan);
  }

  static async approve(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    await TreatmentPlanService.approve(id, clinicId);
    return reply.send({
      message: "Orçamento aprovado e financeiro gerado com sucesso!",
    });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    const data = createTreatmentPlanSchema.parse(request.body);

    try {
      const updatedPlan = await TreatmentPlanService.update(id, clinicId, data);
      return reply.send(updatedPlan);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };

    try {
      await TreatmentPlanService.delete(id, clinicId);
      return reply.send({ message: "Plano excluído com sucesso." });
    } catch (error: any) {
      // Retorna 400 para erros de regra de negócio (segurança)
      return reply.status(400).send({ message: error.message });
    }
  }
}
