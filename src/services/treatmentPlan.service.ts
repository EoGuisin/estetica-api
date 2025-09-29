// src/services/treatmentPlan.service.ts
import { prisma } from "../lib/prisma";

export class TreatmentPlanService {
  static async create(clinicId: string, data: any) {
    const { procedures, ...planData } = data;

    return prisma.treatmentPlan.create({
      data: {
        ...planData,
        clinicId,
        procedures: {
          create: procedures,
        },
      },
    });
  }

  static async list(clinicId: string) {
    return prisma.treatmentPlan.findMany({
      where: { clinicId },
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        _count: { select: { procedures: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getById(id: string, clinicId: string) {
    return prisma.treatmentPlan.findFirst({
      where: { id, clinicId },
      include: {
        patient: true,
        seller: true,
        procedures: {
          include: {
            procedure: true,
          },
        },
      },
    });
  }
}
