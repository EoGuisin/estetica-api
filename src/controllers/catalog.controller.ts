// src/controllers/catalog.controller.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { CatalogService } from "../services/catalog.service";
import {
  genericCatalogSchema,
  procedureSchema,
  roleSchema,
} from "../schemas/catalog.schema";

const getModel = (modelName: string) => {
  if (
    ![
      "specialty",
      "appointmentType",
      "trafficSource",
      "procedure",
      "role",
    ].includes(modelName)
  ) {
    throw new Error("Catálogo inválido");
  }
  return modelName as any;
};

export class CatalogController {
  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };
    const item = await CatalogService.getById(getModel(modelName), id);
    if (!item) {
      return reply.status(404).send({ message: "Item não encontrado." });
    }
    return reply.send(item);
  }
  // A função list não precisa de alteração, pois a genérica já funciona para 'role'
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { modelName } = request.params as { modelName: string };
    const model = getModel(modelName);

    if (model === "procedure") {
      return reply.send(await CatalogService.listProcedures());
    }
    const items = await CatalogService.list(model);
    return reply.send(items);
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { modelName } = request.params as { modelName: string };
    const model = getModel(modelName);

    let data;
    // CORREÇÃO 2: Adicionar um 'else if' para usar o schema de 'role'
    if (model === "procedure") {
      data = procedureSchema.parse(request.body);
      const item = await CatalogService.createProcedure(data);
      return reply.status(201).send(item);
    } else if (model === "role") {
      data = roleSchema.parse(request.body);
    } else {
      data = genericCatalogSchema.parse(request.body);
    }

    const item = await CatalogService.create(model, data);
    return reply.status(201).send(item);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };
    const model = getModel(modelName);

    let data;
    // CORREÇÃO 3: Adicionar um 'else if' para usar o schema de 'role' também na atualização
    if (model === "procedure") {
      data = procedureSchema.parse(request.body);
      const item = await CatalogService.updateProcedure(id, data);
      return reply.send(item);
    } else if (model === "role") {
      data = roleSchema.parse(request.body);
    } else {
      data = genericCatalogSchema.parse(request.body);
    }

    const item = await CatalogService.update(model, id, data);
    return reply.send(item);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };
    await CatalogService.delete(getModel(modelName), id);
    return reply.status(204).send();
  }
}
