import { FastifyRequest, FastifyReply } from "fastify";
import { AdminReportsService } from "../services/adminReports.service";

export class AdminReportsController {
  static async getOverview(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = request.query as any;
    const data = await AdminReportsService.getDashboardMetrics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return reply.send({
      active: data.active,
      canceled: data.canceled,
      trial: data.trial,
      newUsers: data.newUsers,
      revenue: data.grossRevenue,
      netRevenue: data.netRevenue,
    });
  }

  static async getConversion(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = request.query as any;
    const data = await AdminReportsService.getConversionRate(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    return reply.send({ conversionRate: data.rate.toFixed(2) + "%" });
  }

  static async getCancelations(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = request.query as any;
    const data = await AdminReportsService.getCancelationReasons(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    const formatted = data.map((d) => ({
      reason: d.reason,
      count: d._count.reason,
    }));
    return reply.send(formatted);
  }
}
