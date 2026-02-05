import { FastifyRequest, FastifyReply } from "fastify";
import {
  appointmentParamsSchema,
  createAppointmentSchema,
  updateAppointmentStatusSchema,
} from "../schemas/appointment.schema";
import { AppointmentService } from "../services/appointment.service";

export class AppointmentController {
  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { appointmentId } = request.params as { appointmentId: string };

    const data = request.body as any;

    try {
      const appointment = await AppointmentService.update(
        clinicId,
        appointmentId,
        data
      );
      return reply.send(appointment);
    } catch (error: any) {
      return reply.status(400).send({ message: error.message });
    }
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const data = createAppointmentSchema.parse(request.body);

    try {
      const appointment = await AppointmentService.create(clinicId, data);
      return reply.status(201).send(appointment);
    } catch (error: any) {
      if (error.name === "SessionLimitError") {
        return reply.status(409).send({
          message: error.message,
          details: `Sessões já agendadas em: ${error.scheduledDates.join(
            ", "
          )}.`,
        });
      }

      if (error.name === "SchedulingError") {
        return reply.status(400).send({
          message: error.message,
        });
      }

      throw error;
    }
  }

  static async listPatients(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const patients = await AppointmentService.listPatients(clinicId);
    return reply.send(patients);
  }

  static async listTreatmentPlansByPatient(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request;
    const { patientId } = request.params as { patientId: string };
    const plans = await AppointmentService.listTreatmentPlansByPatient(
      clinicId,
      patientId
    );
    return reply.send(plans);
  }

  static async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // ADICIONADO
    const { appointmentId } = appointmentParamsSchema.parse(request.params);
    const { status } = updateAppointmentStatusSchema.parse(request.body);

    const appointment = await AppointmentService.updateStatus(
      clinicId, // PASSADO PARA O SERVICE
      appointmentId,
      status
    );
    return reply.send(appointment);
  }
}
