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
    const { clinicId } = request; // <--- PEGA O ID DA CLÍNICA
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };

    // Passamos clinicId para garantir que ele só veja itens dele ou globais
    const item = await CatalogService.getById(
      getModel(modelName),
      id,
      clinicId
    );

    if (!item) {
      return reply.status(404).send({ message: "Item não encontrado." });
    }
    return reply.send(item);
  }

  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA O ID DA CLÍNICA
    const { modelName } = request.params as { modelName: string };
    const model = getModel(modelName);

    if (model === "procedure") {
      // Procedimentos também precisam ser filtrados por clínica
      return reply.send(await CatalogService.listProcedures(clinicId));
    }

    // Lista genérica filtrada
    const items = await CatalogService.list(model, clinicId);
    return reply.send(items);
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const { modelName } = request.params as { modelName: string };
    const model = getModel(modelName);

    let data;
    if (model === "procedure") {
      data = procedureSchema.parse(request.body);
      // Cria procedimento vinculado à clínica
      const item = await CatalogService.createProcedure(data, clinicId);
      return reply.status(201).send(item);
    } else if (model === "role") {
      data = roleSchema.parse(request.body);
    } else {
      data = genericCatalogSchema.parse(request.body);
    }

    // Cria item genérico vinculado à clínica
    const item = await CatalogService.create(model, data, clinicId);
    return reply.status(201).send(item);
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA O ID DA CLÍNICA
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };
    const model = getModel(modelName);

    let data;
    if (model === "procedure") {
      data = procedureSchema.parse(request.body);
      // Atualiza garantindo que pertence à clínica
      const item = await CatalogService.updateProcedure(id, data, clinicId);
      return reply.send(item);
    } else if (model === "role") {
      data = roleSchema.parse(request.body);
    } else {
      data = genericCatalogSchema.parse(request.body);
    }

    // Atualiza item genérico
    const item = await CatalogService.update(model, id, data, clinicId);
    return reply.send(item);
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request; // <--- PEGA O ID DA CLÍNICA
    const { modelName, id } = request.params as {
      modelName: string;
      id: string;
    };

    // Deleta garantindo que pertence à clínica
    await CatalogService.delete(getModel(modelName), id, clinicId);
    return reply.status(204).send();
  }

  static async importProcedures(request: FastifyRequest, reply: FastifyReply) {
    const { clinicId } = request;
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ message: "Arquivo não enviado." });
    }

    const buffer = await data.toBuffer();
    const result = await CatalogService.importProcedures(buffer, clinicId);

    return reply.send(result);
  }
}
