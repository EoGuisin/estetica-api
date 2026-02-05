// src/controllers/cashRegister.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import {
  openSessionSchema,
  closeSessionSchema,
  sessionParamsSchema,
  bankAccountParamsSchema,
  listSessionsQuerySchema,
} from "../schemas/cashRegister.schema";
import { CashRegisterService } from "../services/cashRegister.service";
import { CashRegisterSessionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export class CashRegisterController {
  static async openSession(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.user;
      const { clinicId } = request;
      const { bankAccountId, observedOpening } = openSessionSchema.parse(
        request.body
      );

      const session = await CashRegisterService.openSession(
        clinicId,
        userId,
        bankAccountId,
        observedOpening
      );
      return reply.status(201).send(session);
    } catch (error: any) {
      if (error.message.includes("Já existe uma sessão")) {
        return reply.status(409).send({ message: error.message });
      }
      throw error;
    }
  }

  static async closeSession(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.user;
    const { clinicId } = request;
    const { sessionId } = sessionParamsSchema.parse(request.params);
    const { observedClosing, notes } = closeSessionSchema.parse(request.body);

    const session = await CashRegisterService.closeSession(
      clinicId,
      userId,
      sessionId,
      observedClosing,
      notes
    );
    return reply.send(session);
  }

  static async getActiveSession(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { bankAccountId } = bankAccountParamsSchema.parse(request.params);
    const data = await CashRegisterService.getActiveSession(
      clinicId,
      bankAccountId
    );
    return reply.send(data);
  }

  static async getSessionDetails(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { sessionId } = sessionParamsSchema.parse(request.params);
    const details = await CashRegisterService.getSessionDetails(
      clinicId,
      sessionId
    );
    return reply.send(details);
  }

  static async listSessions(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { page, pageSize, status, dateStart, dateEnd, bankAccountId } =
      listSessionsQuerySchema.parse(request.query);

    const result = await CashRegisterService.listSessions(
      clinicId,
      Number(page),
      Number(pageSize),
      {
        status: status as CashRegisterSessionStatus,
        dateStart,
        dateEnd,
        bankAccountId,
      }
    );
    return reply.send(result);
  }

  static async getActiveSessionSummary(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const { clinicId } = request;

    // Find all open sessions for this clinic
    const openSessions = await prisma.cashRegisterSession.findMany({
      where: {
        clinicId,
        status: "OPEN",
      },
      include: {
        transactions: {
          where: { type: "REVENUE" }, // We only care about money coming in
          select: { amount: true },
        },
      },
    });

    // Sum the total amount from all transactions in open sessions
    const totalReceivedInOpenSessions = openSessions.reduce((acc, session) => {
      const sessionTotal = session.transactions.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );
      return acc + sessionTotal;
    }, 0);

    return reply.send({ totalReceived: totalReceivedInOpenSessions });
  }
}
