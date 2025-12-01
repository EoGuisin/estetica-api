// src/controllers/patient.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  createPatientSchema,
  updatePatientSchema,
} from "../schemas/patient.schema";
import { PatientService } from "../services/patient.service";

export class PatientController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { clinicId } = request;
      const data = createPatientSchema.parse(request.body);

      const patient = await PatientService.create(clinicId, data);
      return reply.status(201).send(patient);
    } catch (error: any) {
      if (error.code === "P2002" && error.meta?.target.includes("cpf")) {
        return reply
          .status(409)
          .send({ message: "Este CPF já está cadastrado." });
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
      document,
    } = request.query as {
      page?: string;
      pageSize?: string;
      name?: string;
      document?: string;
    };

    const pageNumber = Number.parseInt(page, 10);
    const pageSizeNumber = Number.parseInt(pageSize, 10);

    const result = await PatientService.list(
      clinicId,
      pageNumber,
      pageSizeNumber,
      name,
      document
    );
    return reply.send(result);
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const patient = await PatientService.getById(id, clinicId);
    if (!patient) {
      return reply.status(404).send({ message: "Paciente não encontrado." });
    }
    return reply.send(patient);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    const data = updatePatientSchema.parse(request.body);
    const patient = await PatientService.update(id, clinicId, data);
    return reply.send(patient);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { id } = request.params as { id: string };
    await PatientService.delete(id, clinicId);
    return reply.status(204).send();
  }
}
