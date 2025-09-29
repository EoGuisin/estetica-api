import { FastifyRequest, FastifyReply } from "fastify";
import { TreatmentPlanService } from "../services/treatmentPlan.service";
import { createTreatmentPlanSchema } from "../schemas/treatmentPlan.schema";

export class TreatmentPlanController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createTreatmentPlanSchema.parse(request.body);
    const plan = await TreatmentPlanService.create(clinicId, data);
    return reply.status(201).send(plan);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const plans = await TreatmentPlanService.list(clinicId);
    return reply.send(plans);
  }
  
  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { id } = request.params as { id: string };
    const plan = await TreatmentPlanService.getById(id, clinicId);
    if (!plan) {
      return reply.status(404).send({ message: "Plano não encontrado." });
    }
    return reply.send(plan);
  }
}
