// src/controllers/appointment.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { createAppointmentSchema } from "../schemas/appointment.schema";
import { AppointmentService } from "../services/appointment.service";

export class AppointmentController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const data = createAppointmentSchema.parse(request.body);

    const appointment = await AppointmentService.create(clinicId, data);
    return reply.status(201).send(appointment);
  }

  static async listPatients(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const patients = await AppointmentService.listPatients(clinicId);
    return reply.send(patients);
  }

  static async listAppointmentTypes(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const types = await AppointmentService.listAppointmentTypes();
    return reply.send(types);
  }
  
  static async listTreatmentPlansByPatient(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request.user;
    const { patientId } = request.params as { patientId: string };
    const plans = await AppointmentService.listTreatmentPlansByPatient(clinicId, patientId);
    return reply.send(plans);
  }
}
