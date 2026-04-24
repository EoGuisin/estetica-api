// src/controllers/adminAi.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { AdminAiService } from "../services/adminAi.service";
import { createAiArticleSchema } from "../schemas/adminAi.schema";

export class AdminAiController {
  static async listArticles(request: FastifyRequest, reply: FastifyReply) {
    const articles = await AdminAiService.listArticles();
    return reply.send(articles);
  }

  static async createArticle(request: FastifyRequest, reply: FastifyReply) {
    const data = createAiArticleSchema.parse(request.body);
    const result = await AdminAiService.createArticle(data);
    return reply.status(201).send(result);
  }

  static async deleteArticle(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await AdminAiService.deleteArticle(id);
    return reply.send({ success: true });
  }
}
