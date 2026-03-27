import { FastifyInstance } from "fastify";
import { TicketController } from "../controllers/ticket.controller";

export async function ticketRoutes(app: FastifyInstance) {
  app.post("/", TicketController.createTicket);
  app.get("/", TicketController.listTickets);
  app.get("/:id", TicketController.getTicketById);
  app.post("/:id/messages", TicketController.addMessage);
  app.get("/admin/all", TicketController.listAllSystemTickets);
  app.get("/admin/:id", TicketController.getAdminTicketById);
  app.post("/admin/:id/messages", TicketController.addAdminMessage);
}
