import { prisma } from "../lib/prisma";
import {
  CreateTicketInput,
  AddTicketMessageInput,
} from "../schemas/ticket.schema";

export class TicketService {
  static async createTicket(
    clinicId: string,
    userId: string,
    data: CreateTicketInput
  ) {
    return prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        clinicId: clinicId,
        openedById: userId,
        status: "OPEN",
        attachments: data.attachments
          ? {
              create: data.attachments.map((att) => ({
                fileName: att.fileName,
                filePath: att.filePath,
                fileType: att.fileType,
                size: att.size,
              })),
            }
          : undefined,
      },
      include: { attachments: true },
    });
  }

  static async listTickets(clinicId: string) {
    return prisma.ticket.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
      include: {
        openedBy: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true } },
        _count: { select: { messages: true } },
      },
    });
  }

  static async getTicketById(
    clinicId: string,
    ticketId: string,
    userId: string,
    userRole?: string
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, clinicId },
      include: {
        openedBy: { select: { id: true, fullName: true } },
        attachments: true,
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            sender: { select: { id: true, fullName: true } },
            attachments: true,
          },
          where: userRole !== "ADMIN" ? { isInternal: false } : undefined,
        },
      },
    });

    if (!ticket) {
      throw { code: "NOT_FOUND", message: "Ticket não encontrado." };
    }

    return ticket;
  }

  static async addMessage(
    clinicId: string,
    ticketId: string,
    userId: string,
    data: AddTicketMessageInput
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, clinicId },
      select: { id: true, openedById: true },
    });

    if (!ticket) {
      throw { code: "NOT_FOUND", message: "Ticket não encontrado." };
    }

    // Lógica 100% pronta: Se quem mandou a msg for o dono do ticket, o status vira OPEN (para o suporte ver).
    // Se for alguém da equipe de suporte respondendo, o status vira WAITING_REPLY (esperando o cliente).
    const newStatus = ticket.openedById === userId ? "OPEN" : "WAITING_REPLY";

    // Executa a criação da mensagem e a atualização do status na mesma transação
    const [message] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          content: data.content,
          isInternal: data.isInternal || false,
          ticketId: ticketId,
          senderId: userId,
          attachments: data.attachments
            ? {
                create: data.attachments.map((att) => ({
                  fileName: att.fileName,
                  filePath: att.filePath,
                  fileType: att.fileType,
                  size: att.size,
                  ticketId: ticketId, // Vincula ao ticket principal também por segurança relacional
                })),
              }
            : undefined,
        },
        include: { attachments: true },
      }),
      // Atualiza o ticket pai com a nova data de modificação e novo status
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: newStatus },
      }),
    ]);

    return message;
  }

  static async listAllSystemTickets() {
    return prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        // Traz as informações de quem abriu
        openedBy: {
          select: { id: true, fullName: true, email: true },
        },
        // Traz a clínica e a conta mestre (Account) dona da clínica
        clinic: {
          select: {
            id: true,
            name: true,
            account: {
              select: {
                id: true,
                owner: {
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
        _count: { select: { messages: true } },
      },
    });
  }

  static async getAdminTicketById(ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        openedBy: { select: { id: true, fullName: true, email: true } },
        clinic: { select: { id: true, name: true } },
        attachments: true,
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            sender: {
              select: { id: true, fullName: true, isSystemOwner: true },
            },
            attachments: true,
          },
        },
      },
    });
    if (!ticket) throw { code: "NOT_FOUND", message: "Ticket não encontrado." };
    return ticket;
  }

  // Responde um ticket como Super Admin
  static async addAdminMessage(
    ticketId: string,
    userId: string,
    data: AddTicketMessageInput
  ) {
    const [message] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          content: data.content,
          isInternal: data.isInternal || false,
          ticketId: ticketId,
          senderId: userId,
        },
      }),
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "WAITING_REPLY" },
      }),
    ]);
    return message;
  }
}
