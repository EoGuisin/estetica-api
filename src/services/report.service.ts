// src/services/report.service.ts
import { prisma } from "../lib/prisma";
import PdfService from "./pdf.service";
import {
  Appointment,
  Clinic,
  CommissionRecord,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Product,
  TreatmentPlan,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { differenceInDays, subDays } from "date-fns";
import { ReportTemplateService } from "./report.template";
import {
  accountsPayableReportQuerySchema,
  accountsReceivableReportQuerySchema,
  appointmentsReportQuerySchema,
  attendedPatientsReportQuerySchema,
  cashStatementReportQuerySchema,
  commissionReportQuerySchema,
  expiredProductsReportQuerySchema,
  inactivePatientsReportQuerySchema,
  paymentMethodsReportQuerySchema,
  professionalValueReportQuerySchema,
  salesReportQuerySchema,
  stockAvailabilityReportQuerySchema,
  stockMovementReportQuerySchema,
} from "../schemas/report.schema";
import z from "zod";

// ===================================================================================
// TIPOS EXPORTADOS (Usados no Template)
// ===================================================================================

export type AppointmentWithIncludes = Appointment & {
  professional: { fullName: string };
  patient: { name: string };
  appointmentType: { name: string };
  treatmentPlan:
    | (TreatmentPlan & {
        paymentInstallments: { status: PaymentStatus }[];
      })
    | null;
};

export type ReportFilters = z.infer<typeof appointmentsReportQuerySchema>;
export type ProfessionalValueReportFilters = z.infer<
  typeof professionalValueReportQuerySchema
>;

export type FlatProfessionalValueData = {
  patientName: string;
  specialtyName: string;
  procedureName: string;
  procedureValue: Decimal;
  dueDate: Date;
  paymentDate: Date | null;
  paidAmount: Decimal;
  paymentMethod: PaymentMethod | null;
  installmentInfo: string;
};

export type CommissionReportFilters = z.infer<
  typeof commissionReportQuerySchema
>;

export type CommissionRecordWithIncludes = CommissionRecord & {
  professional: { fullName: string };
  treatmentPlan: {
    total: Decimal;
    patient: { name: string };
  };
};

export type AttendedPatientsReportFilters = z.infer<
  typeof attendedPatientsReportQuerySchema
>;

export type ProcessedPatient = {
  name: string;
  cpf: string;
  phone: string;
  specialty: string;
};

export type ProductWithCost = Product & {
  category: { name: string };
  unitCost: Decimal;
  totalValue: Decimal;
};

export type ProcessedInactivePatient = {
  name: string;
  phone: string;
  lastAppointment: Date;
  daysInactive: number;
};

// ===================================================================================
// CLASSE PRINCIPAL DO SERVIÇO
// ===================================================================================

export class ReportService {
  /**
   * Helper Interno para corrigir o Fuso Horário de forma segura
   */
  private static parseDateSafe(
    dateString: string,
    isEndOfDay: boolean = false
  ): Date {
    // Força o fuso horário de Brasília (-03:00) para evitar que o servidor em UTC troque o dia
    const timeString = isEndOfDay
      ? "T23:59:59.999-03:00"
      : "T00:00:00.000-03:00";
    return new Date(`${dateString}${timeString}`);
  }

  static async generateAppointmentsReport(
    clinicId: string,
    filters: ReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, taxId: true, address: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const appointments = (await prisma.appointment.findMany({
      where: {
        patient: { clinicId },
        date: { gte: startDateObj, lte: endDateObj },
        professionalId: professionalId || undefined,
      },
      include: {
        professional: { select: { fullName: true } },
        patient: { select: { name: true } },
        appointmentType: { select: { name: true } },
        treatmentPlan: {
          select: {
            id: true,
            total: true,
            paymentInstallments: { select: { status: true } },
          },
        },
      },
      orderBy: [
        { professional: { fullName: "asc" } },
        { date: "asc" },
        { startTime: "asc" },
      ],
    })) as AppointmentWithIncludes[];

    const groupedByProfessional = appointments.reduce((acc, app) => {
      const profName = app.professional.fullName;
      if (!acc[profName]) acc[profName] = [];
      acc[profName].push(app);
      return acc;
    }, {} as Record<string, AppointmentWithIncludes[]>);

    const uniquePlanIds = new Set<string>();
    for (const app of appointments) {
      if (app.treatmentPlanId) uniquePlanIds.add(app.treatmentPlanId);
    }

    let totalValue = 0;
    if (uniquePlanIds.size > 0) {
      const planTotals = await prisma.treatmentPlan.aggregate({
        _sum: { total: true },
        where: { id: { in: Array.from(uniquePlanIds) } },
      });
      totalValue = planTotals._sum.total?.toNumber() || 0;
    }

    const summary = {
      totalAppointments: appointments.length,
      totalValue: totalValue,
    };

    const html = ReportTemplateService.getAppointmentsReportHtml(
      clinic,
      groupedByProfessional,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateProfessionalValueReport(
    clinicId: string,
    filters: ProfessionalValueReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    const professional = await prisma.user.findUnique({
      where: { id: professionalId },
      select: { fullName: true },
    });
    if (!clinic || !professional)
      throw new Error("Clínica ou profissional não encontrado.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const installments = await prisma.paymentInstallment.findMany({
      where: {
        clinicId: clinicId,
        status: "PAID",
        paymentDate: { gte: startDateObj, lte: endDateObj },
        treatmentPlan: { sellerId: professionalId },
      },
      include: {
        treatmentPlan: {
          include: {
            patient: { select: { name: true } },
            procedures: {
              include: {
                procedure: {
                  include: { specialty: { select: { name: true } } },
                },
              },
            },
            _count: { select: { paymentInstallments: true } },
          },
        },
      },
      orderBy: { paymentDate: "asc" },
    });

    const flattenedData: FlatProfessionalValueData[] = [];
    let totalPaid = new Decimal(0);
    const patientSet = new Set<string>();

    for (const installment of installments) {
      if (!installment.paidAmount) continue;
      totalPaid = totalPaid.add(installment.paidAmount);
      patientSet.add(installment.treatmentPlan.patient.name);

      const installmentInfo = `${installment.installmentNumber}/${installment.treatmentPlan._count.paymentInstallments}`;

      for (const planProcedure of installment.treatmentPlan.procedures) {
        flattenedData.push({
          patientName: installment.treatmentPlan.patient.name,
          specialtyName: planProcedure.procedure.specialty.name,
          procedureName: planProcedure.procedure.name,
          procedureValue: planProcedure.unitPrice,
          dueDate: installment.dueDate,
          paymentDate: installment.paymentDate,
          paidAmount: installment.paidAmount,
          paymentMethod: installment.paymentMethod,
          installmentInfo,
        });
      }
    }

    const summary = {
      totalValuePaid: totalPaid.toNumber(),
      totalPatients: patientSet.size,
    };
    const html = ReportTemplateService.getProfessionalValueReportHtml(
      clinic,
      professional.fullName,
      flattenedData,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateCommissionReport(
    clinicId: string,
    filters: CommissionReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    const professional = await prisma.user.findUnique({
      where: { id: professionalId },
      select: { fullName: true },
    });
    if (!clinic || !professional)
      throw new Error("Clínica ou profissional não encontrado.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const records = (await prisma.commissionRecord.findMany({
      where: {
        clinicId: clinicId,
        professionalId: professionalId,
        calculationDate: { gte: startDateObj, lte: endDateObj },
      },
      include: {
        professional: { select: { fullName: true } },
        treatmentPlan: {
          select: { total: true, patient: { select: { name: true } } },
        },
      },
      orderBy: { calculationDate: "asc" },
    })) as CommissionRecordWithIncludes[];

    let totalPending = new Decimal(0);
    let totalPaid = new Decimal(0);

    for (const record of records) {
      if (record.status === "PAID")
        totalPaid = totalPaid.add(record.calculatedAmount);
      else if (record.status === "PENDING")
        totalPending = totalPending.add(record.calculatedAmount);
    }

    const summary = {
      totalPending: totalPending.toNumber(),
      totalPaid: totalPaid.toNumber(),
      totalOverall: totalPending.add(totalPaid).toNumber(),
    };
    const html = ReportTemplateService.getCommissionReportHtml(
      clinic,
      professional.fullName,
      records,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateAttendedPatientsReport(
    clinicId: string,
    filters: AttendedPatientsReportFilters
  ) {
    const { startDate, endDate, professionalId, specialtyId } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    const professional = professionalId
      ? await prisma.user.findUnique({
          where: { id: professionalId },
          select: { fullName: true },
        })
      : null;
    const specialty = specialtyId
      ? await prisma.specialty.findUnique({
          where: { id: specialtyId },
          select: { name: true },
        })
      : null;
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const where: Prisma.AppointmentWhereInput = {
      patient: { clinicId: clinicId },
      date: { gte: startDateObj, lte: endDateObj },
    };
    if (professionalId) where.professionalId = professionalId;
    if (specialtyId)
      where.treatmentPlan = {
        procedures: { some: { procedure: { specialtyId: specialtyId } } },
      };

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            cpf: true,
            phones: {
              select: { number: true },
              take: 1,
              orderBy: { isWhatsapp: "desc" },
            },
          },
        },
        treatmentPlan: {
          select: {
            procedures: {
              select: {
                procedure: {
                  select: { specialty: { select: { name: true } } },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    const uniquePatients = new Map<string, ProcessedPatient>();
    for (const app of appointments) {
      if (!uniquePatients.has(app.patient.id)) {
        uniquePatients.set(app.patient.id, {
          name: app.patient.name,
          cpf: ReportTemplateService.escapeHtml(app.patient.cpf),
          phone: ReportTemplateService.escapeHtml(
            app.patient.phones[0]?.number
          ),
          specialty:
            app.treatmentPlan?.procedures[0]?.procedure.specialty.name || "N/A",
        });
      }
    }

    const summary = { totalPatients: uniquePatients.size };
    const html = ReportTemplateService.getAttendedPatientsReportHtml(
      clinic,
      professional?.fullName || "Todos",
      specialty?.name || "Todas",
      Array.from(uniquePatients.values()),
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateAccountsReceivableReport(
    clinicId: string,
    filters: z.infer<typeof accountsReceivableReportQuerySchema>
  ) {
    const { startDate, endDate, status } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const installments = await prisma.paymentInstallment.findMany({
      where: {
        clinicId: clinicId,
        status: status || { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: startDateObj, lte: endDateObj },
      },
      include: {
        treatmentPlan: { select: { patient: { select: { name: true } } } },
      },
      orderBy: { dueDate: "asc" },
    });

    let totalPending = new Decimal(0),
      totalOverdue = new Decimal(0);
    for (const inst of installments) {
      if (inst.status === "PENDING")
        totalPending = totalPending.add(inst.amountDue);
      else if (inst.status === "OVERDUE")
        totalOverdue = totalOverdue.add(inst.amountDue);
    }
    const summary = {
      totalPending: totalPending.toNumber(),
      totalOverdue: totalOverdue.toNumber(),
      totalOverall: totalPending.add(totalOverdue).toNumber(),
    };

    const html = ReportTemplateService.getAccountsReceivableHtml(
      clinic,
      installments,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateAccountsPayableReport(
    clinicId: string,
    filters: z.infer<typeof accountsPayableReportQuerySchema>
  ) {
    const { startDate, endDate, status, categoryId, supplierId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const expenses = await prisma.expense.findMany({
      where: {
        clinicId: clinicId,
        status: status || { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: startDateObj, lte: endDateObj },
        categoryId: categoryId || undefined,
        supplierId: supplierId || undefined,
      },
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    let totalPending = new Decimal(0),
      totalOverdue = new Decimal(0);
    for (const exp of expenses) {
      if (exp.status === "PENDING") totalPending = totalPending.add(exp.amount);
      else if (exp.status === "OVERDUE")
        totalOverdue = totalOverdue.add(exp.amount);
    }
    const summary = {
      totalPending: totalPending.toNumber(),
      totalOverdue: totalOverdue.toNumber(),
      totalOverall: totalPending.add(totalOverdue).toNumber(),
    };

    const html = ReportTemplateService.getAccountsPayableHtml(
      clinic,
      expenses,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateStockAvailabilityReport(
    clinicId: string,
    filters: z.infer<typeof stockAvailabilityReportQuerySchema>
  ) {
    const { categoryId, brandId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const products = await prisma.product.findMany({
      where: {
        clinicId,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
      },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    let grandTotalValue = new Decimal(0);

    // N+1 RESOLVIDO: Em vez de fazer uma query para cada produto, usamos o lastCostPrice
    const productsWithCost: ProductWithCost[] = products.map((product) => {
      const unitCost = product.lastCostPrice || new Decimal(0);
      const totalValue = unitCost.times(product.currentStock);
      grandTotalValue = grandTotalValue.add(totalValue);

      return { ...product, unitCost, totalValue };
    });

    const summary = {
      totalValueInStock: grandTotalValue.toNumber(),
      totalItems: products.reduce((acc, p) => acc + p.currentStock, 0),
    };

    const html = ReportTemplateService.getStockAvailabilityHtml(
      clinic,
      productsWithCost,
      summary
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateStockMovementReport(
    clinicId: string,
    filters: z.infer<typeof stockMovementReportQuerySchema>
  ) {
    const { startDate, endDate, type, productId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const movements = await prisma.stockMovement.findMany({
      where: {
        product: { clinicId },
        type,
        date: { gte: startDateObj, lte: endDateObj },
        productId: productId || undefined,
      },
      include: {
        product: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    });

    let totalQuantity = 0;
    let totalValue = new Decimal(0);
    for (const move of movements) {
      totalQuantity += move.quantity;
      if (move.totalValue) totalValue = totalValue.add(move.totalValue);
    }
    const summary = { totalQuantity, totalValue: totalValue.toNumber() };

    const html = ReportTemplateService.getStockMovementHtml(
      clinic,
      movements,
      summary,
      type,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateSalesReport(
    clinicId: string,
    filters: z.infer<typeof salesReportQuerySchema>
  ) {
    const { startDate, endDate, sellerId, status } = filters;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const where: Prisma.TreatmentPlanWhereInput = {
      clinicId,
      createdAt: { gte: startDateObj, lte: endDateObj },
      sellerId: sellerId || undefined,
    };

    let reportTitle = "Relatório de Vendas";
    if (status === "APPROVED") {
      where.status = "APPROVED";
      reportTitle = "Relatório de Vendas Efetivadas";
    } else if (status === "DRAFT") {
      where.status = "DRAFT";
      reportTitle = "Relatório de Orçamentos (Em Aberto)";
    } else {
      where.status = { in: ["APPROVED", "DRAFT"] };
      reportTitle = "Relatório Geral (Vendas e Orçamentos)";
    }

    const plans = await prisma.treatmentPlan.findMany({
      where,
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        procedures: { include: { procedure: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalValue = new Decimal(0);
    for (const plan of plans) totalValue = totalValue.add(plan.total);

    const totalSales = plans.length;
    const avgTicket =
      totalSales > 0 ? totalValue.dividedBy(totalSales) : new Decimal(0);

    const topProcedureAgg = await prisma.treatmentPlanProcedure.groupBy({
      by: ["procedureId"],
      where: { treatmentPlan: where },
      _sum: { contractedSessions: true },
      orderBy: { _sum: { contractedSessions: "desc" } },
      take: 1,
    });

    let topProcedureName = "N/A";
    if (topProcedureAgg.length > 0) {
      const procedure = await prisma.procedure.findUnique({
        where: { id: topProcedureAgg[0].procedureId },
        select: { name: true },
      });
      topProcedureName = `${procedure?.name} (${topProcedureAgg[0]._sum.contractedSessions} sessões)`;
    }

    let topSellerName = "N/A";
    if (!sellerId) {
      const topSellerAgg = await prisma.treatmentPlan.groupBy({
        by: ["sellerId"],
        where: where,
        _sum: { total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 1,
      });

      if (topSellerAgg.length > 0) {
        const seller = await prisma.user.findUnique({
          where: { id: topSellerAgg[0].sellerId },
          select: { fullName: true },
        });
        const formatMoney = (val: any) =>
          new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(val));
        topSellerName = `${seller?.fullName} (${formatMoney(
          topSellerAgg[0]._sum.total || 0
        )})`;
      }
    }

    const summary = {
      totalValue: totalValue.toNumber(),
      totalSales,
      avgTicket: avgTicket.toNumber(),
      topProcedure: topProcedureName,
      topSeller: topSellerName,
    };
    const html = ReportTemplateService.getSalesHtml(
      clinic,
      plans,
      summary,
      startDateObj,
      endDateObj,
      !!sellerId,
      reportTitle
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(
        clinic.name,
        reportTitle
      ),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generatePaymentMethodsReport(
    clinicId: string,
    filters: z.infer<typeof paymentMethodsReportQuerySchema>
  ) {
    const { startDate, endDate } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const aggregatedData = await prisma.paymentInstallment.groupBy({
      by: ["paymentMethod"],
      where: {
        clinicId: clinicId,
        status: "PAID",
        paymentDate: { gte: startDateObj, lte: endDateObj },
      },
      _sum: { paidAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { paidAmount: "desc" } },
    });

    let grandTotal = new Decimal(0);
    for (const group of aggregatedData)
      grandTotal = grandTotal.add(group._sum.paidAmount || 0);

    const summary = { totalReceived: grandTotal.toNumber() };
    const html = ReportTemplateService.getPaymentMethodsHtml(
      clinic,
      aggregatedData,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateInactivePatientsReport(
    clinicId: string,
    filters: z.infer<typeof inactivePatientsReportQuerySchema>
  ) {
    const { days } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const today = new Date();
    const thresholdDate = subDays(today, days);

    const patients = await prisma.patient.findMany({
      where: { clinicId },
      include: {
        phones: { take: 1, orderBy: { isWhatsapp: "desc" } },
        appointments: { orderBy: { date: "desc" }, take: 1 },
      },
    });

    const inactivePatients: ProcessedInactivePatient[] = [];
    for (const p of patients) {
      if (p.appointments.length > 0 && p.appointments[0].date < thresholdDate) {
        inactivePatients.push({
          name: p.name,
          phone: ReportTemplateService.escapeHtml(p.phones[0]?.number),
          lastAppointment: p.appointments[0].date,
          daysInactive: differenceInDays(today, p.appointments[0].date),
        });
      }
    }

    inactivePatients.sort((a, b) => b.daysInactive - a.daysInactive);
    const summary = {
      totalInactive: inactivePatients.length,
      daysFilter: days,
    };
    const html = ReportTemplateService.getInactivePatientsHtml(
      clinic,
      inactivePatients,
      summary
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateCashStatementReport(
    clinicId: string,
    filters: z.infer<typeof cashStatementReportQuerySchema>
  ) {
    const { startDate, endDate, bankAccountId, type } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    const startDateObj = this.parseDateSafe(startDate, false);
    const endDateObj = this.parseDateSafe(endDate, true);

    const transactions = await prisma.financialTransaction.findMany({
      where: {
        clinicId,
        date: { gte: startDateObj, lte: endDateObj },
        bankAccountId: bankAccountId || undefined,
        type: type || undefined,
      },
      include: {
        paymentInstallment: {
          select: {
            dueDate: true,
            paymentMethod: true,
            treatmentPlan: { select: { patient: { select: { name: true } } } },
          },
        },
        expense: {
          select: { dueDate: true, supplier: { select: { name: true } } },
        },
      },
      orderBy: { date: "asc" },
    });

    let totalRevenue = new Decimal(0),
      totalExpense = new Decimal(0);
    const paymentMethodTotals: Record<string, Decimal> = {};

    for (const t of transactions) {
      if (t.type === "REVENUE") {
        totalRevenue = totalRevenue.add(t.amount);
        const method = t.paymentInstallment?.paymentMethod ?? null;
        const methodName = ReportTemplateService.formatPaymentMethod(method);
        if (!paymentMethodTotals[methodName])
          paymentMethodTotals[methodName] = new Decimal(0);
        paymentMethodTotals[methodName] = paymentMethodTotals[methodName].add(
          t.amount
        );
      } else if (t.type === "EXPENSE") {
        totalExpense = totalExpense.add(t.amount);
      }
    }

    const paymentMethodBreakdown = Object.entries(paymentMethodTotals)
      .map(([name, total]) => ({ name, total: total.toNumber() }))
      .sort((a, b) => b.total - a.total);
    const summary = {
      totalRevenue: totalRevenue.toNumber(),
      totalExpense: totalExpense.toNumber(),
      netTotal: totalRevenue.sub(totalExpense).toNumber(),
      paymentMethodBreakdown,
    };

    const html = ReportTemplateService.getCashStatementHtml(
      clinic,
      transactions,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  static async generateExpiredProductsReport(
    clinicId: string,
    filters: z.infer<typeof expiredProductsReportQuerySchema>
  ) {
    const dateString = filters.date
      ? String(filters.date).split("T")[0]
      : new Date().toISOString().split("T")[0];
    const referenceDate = this.parseDateSafe(dateString, true);

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });

    const expiredEntries = await prisma.stockMovement.findMany({
      where: {
        product: { clinicId },
        type: "ENTRY",
        expiryDate: { lt: referenceDate },
      },
      include: { product: { include: { category: true } } },
      orderBy: { expiryDate: "asc" },
    });

    const html = ReportTemplateService.getExpiredProductsHtml(
      clinic!,
      expiredEntries,
      referenceDate
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: ReportTemplateService.getPdfHeader(clinic!.name),
      footerTemplate: ReportTemplateService.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }
}
