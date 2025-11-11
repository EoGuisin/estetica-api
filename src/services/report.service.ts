// src/services/report.service.ts
import { prisma } from "../lib/prisma";
import PdfService from "./pdf.service";
import {
  Appointment,
  Clinic,
  CommissionRecord,
  CommissionStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Product,
  StockMovementType,
  TransactionType,
  TreatmentPlan,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { differenceInDays, format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  accountsPayableReportQuerySchema,
  accountsReceivableReportQuerySchema,
  appointmentsReportQuerySchema,
  attendedPatientsReportQuerySchema,
  cashStatementReportQuerySchema,
  commissionReportQuerySchema,
  inactivePatientsReportQuerySchema,
  paymentMethodsReportQuerySchema,
  professionalValueReportQuerySchema,
  salesReportQuerySchema,
  stockAvailabilityReportQuerySchema,
  stockMovementReportQuerySchema,
} from "../schemas/report.schema";
import z from "zod";

// ===================================================================================
// TIPOS E INTERFACES AUXILIARES
// ===================================================================================

type AppointmentWithIncludes = Appointment & {
  professional: { fullName: string };
  patient: { name: string };
  appointmentType: { name: string };
  treatmentPlan:
    | (TreatmentPlan & {
        paymentInstallments: {
          status: PaymentStatus;
        }[];
      })
    | null;
};

type ReportFilters = z.infer<typeof appointmentsReportQuerySchema>;
type ProfessionalValueReportFilters = z.infer<
  typeof professionalValueReportQuerySchema
>;

type FlatProfessionalValueData = {
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

type CommissionReportFilters = z.infer<typeof commissionReportQuerySchema>;

type CommissionRecordWithIncludes = CommissionRecord & {
  professional: { fullName: string };
  treatmentPlan: {
    total: Decimal;
    patient: { name: string };
  };
};

type AttendedPatientsReportFilters = z.infer<
  typeof attendedPatientsReportQuerySchema
>;

type ProcessedPatient = {
  name: string;
  cpf: string;
  phone: string;
  specialty: string;
};

type ProductWithCost = Product & {
  category: { name: string };
  unitCost: Decimal;
  totalValue: Decimal;
};

type ProcessedInactivePatient = {
  name: string;
  phone: string;
  lastAppointment: Date;
  daysInactive: number;
};

// ===================================================================================
// CLASSE PRINCIPAL DO SERVIÇO
// ===================================================================================

export class ReportService {
  // =================================================================================
  // PARTE A: Helpers Privados (Formatação e Reutilizáveis)
  // =================================================================================

  /**
   * Gera o template do Cabeçalho do PDF
   */
  private static getPdfHeader(clinicName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 10px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
        <h1 style="margin: 0; font-size: 14px;">${clinicName}</h1>
      </div>
    `;
  }

  /**
   * Gera o template do Rodapé do PDF
   */
  private static getPdfFooter(): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: right; width: 100%; padding: 0 20px;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>
    `;
  }

  /**
   * Helper para formatar moeda
   */
  private static formatCurrency(value: number | Decimal): string {
    const numValue = typeof value === "number" ? value : value.toNumber();
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  }

  /**
   * Helper para formatar Forma de Pagamento
   */
  private static formatPaymentMethod(method: PaymentMethod | null): string {
    if (!method) return "Não Registrado";
    switch (method) {
      case "CREDIT_CARD":
        return "Cartão de Crédito";
      case "DEBIT_CARD":
        return "Cartão de Débito";
      case "BANK_TRANSFER":
        return "PIX / Transf.";
      case "CASH":
        return "Dinheiro";
      case "CHECK":
        return "Cheque";
      case "OTHER":
        return "Outro";
      default:
        return "N/A";
    }
  }

  /**
   * Helper para formatar Status de Pagamento (Parcela/Despesa)
   */
  private static formatPaymentStatus(status: PaymentStatus): string {
    switch (status) {
      case "PENDING":
        return "A Vencer";
      case "OVERDUE":
        return "Vencido";
      case "PAID":
        return "Pago";
      case "CANCELED":
        return "Cancelado";
      default:
        return "N/A";
    }
  }

  /**
   * Helper para formatar Status da Comissão
   */
  private static formatCommissionStatus(status: CommissionStatus): string {
    switch (status) {
      case "PAID":
        return "Paga";
      case "PENDING":
        return "Pendente";
      case "CANCELED":
        return "Cancelada";
      default:
        return "N/A";
    }
  }

  /**
   * Helper para formatar Tipo de Transação Financeira
   */
  private static formatTransactionType(type: TransactionType): string {
    switch (type) {
      case "REVENUE":
        return "Entrada (Receita)";
      case "EXPENSE":
        return "Saída (Despesa)";
      case "TRANSFER":
        return "Transferência";
      default:
        return type;
    }
  }

  /**
   * Helper para formatar CPF
   */
  private static formatCpf(cpf: string | null | undefined): string {
    if (!cpf) return "N/A";
    // Formata XXX.XXX.XXX-XX
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  /**
   * Helper para formatar Telefone
   */
  private static formatPhone(phone: string | null | undefined): string {
    if (!phone) return "N/A";
    // Tenta formatar (XX) XXXXX-XXXX
    if (phone.length === 11) {
      return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    // Tenta formatar (XX) XXXX-XXXX
    if (phone.length === 10) {
      return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone; // Retorna original se não bater
  }

  /**
   * Helper para derivar status de pagamento do plano (baseado em agendamentos)
   */
  private static getPlanPaymentStatus(
    plan: AppointmentWithIncludes["treatmentPlan"]
  ): string {
    if (!plan) return "N/A";
    const installments = plan.paymentInstallments;
    if (!installments || installments.length === 0) return "Pendente";

    const allPaid = installments.every((i) => i.status === "PAID");
    if (allPaid) return "Pago";

    const someOverdue = installments.some((i) => i.status === "OVERDUE");
    if (someOverdue) return "Vencido";

    const somePaid = installments.some((i) => i.status === "PAID");
    if (somePaid) return "Parcial";

    return "Pendente";
  }

  /**
   * Helper para encontrar o custo unitário de um produto
   * (Baseado na última entrada com valor)
   */
  private static async getProductUnitCost(
    tx: Prisma.TransactionClient,
    productId: string
  ): Promise<Decimal> {
    const lastEntry = await tx.stockMovement.findFirst({
      where: {
        productId,
        type: StockMovementType.ENTRY,
        totalValue: { not: null, gt: 0 },
        quantity: { gt: 0 },
      },
      orderBy: { date: "desc" },
    });

    if (!lastEntry || !lastEntry.totalValue) {
      return new Decimal(0);
    }
    return lastEntry.totalValue.dividedBy(lastEntry.quantity);
  }

  // =================================================================================
  // PARTE B: Geradores de Relatório (Públicos)
  // =================================================================================

  /**
   * 1. Relatório de Atendimentos
   */
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

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

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

    const html = this.getReportHtml(
      clinic,
      groupedByProfessional,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 2. Relatório de Valor por Profissional
   */
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
    if (!clinic || !professional) {
      throw new Error("Clínica ou profissional não encontrado.");
    }

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

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
            _count: {
              select: { paymentInstallments: true },
            },
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
      const currentInstallment = installment.installmentNumber;
      const totalInstallments =
        installment.treatmentPlan._count.paymentInstallments;
      const installmentInfo = `${currentInstallment}/${totalInstallments}`;

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
          installmentInfo: installmentInfo,
        });
      }
    }

    const summary = {
      totalValuePaid: totalPaid.toNumber(),
      totalPatients: patientSet.size,
    };

    const html = this.getProfessionalValueReportHtml(
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
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 3. Relatório de Comissão do Vendedor
   */
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
    if (!clinic || !professional) {
      throw new Error("Clínica ou profissional não encontrado.");
    }

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const records = (await prisma.commissionRecord.findMany({
      where: {
        clinicId: clinicId,
        professionalId: professionalId,
        calculationDate: { gte: startDateObj, lte: endDateObj },
      },
      include: {
        professional: { select: { fullName: true } },
        treatmentPlan: {
          select: {
            total: true,
            patient: { select: { name: true } },
          },
        },
      },
      orderBy: { calculationDate: "asc" },
    })) as CommissionRecordWithIncludes[];

    let totalPending = new Decimal(0);
    let totalPaid = new Decimal(0);

    for (const record of records) {
      if (record.status === CommissionStatus.PAID) {
        totalPaid = totalPaid.add(record.calculatedAmount);
      } else if (record.status === CommissionStatus.PENDING) {
        totalPending = totalPending.add(record.calculatedAmount);
      }
    }

    const summary = {
      totalPending: totalPending.toNumber(),
      totalPaid: totalPaid.toNumber(),
      totalOverall: totalPending.add(totalPaid).toNumber(),
    };

    const html = this.getCommissionReportHtml(
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
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 4. Relatório de Pacientes Atendidos
   */
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

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.AppointmentWhereInput = {
      patient: { clinicId: clinicId },
      date: { gte: startDateObj, lte: endDateObj },
    };
    if (professionalId) {
      where.professionalId = professionalId;
    }
    if (specialtyId) {
      where.treatmentPlan = {
        procedures: {
          some: { procedure: { specialtyId: specialtyId } },
        },
      };
    }

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
        const specialtyName =
          app.treatmentPlan?.procedures[0]?.procedure.specialty.name || "N/A";
        uniquePatients.set(app.patient.id, {
          name: app.patient.name,
          cpf: this.formatCpf(app.patient.cpf),
          phone: this.formatPhone(app.patient.phones[0]?.number),
          specialty: specialtyName,
        });
      }
    }

    const patientDataList = Array.from(uniquePatients.values());
    const summary = { totalPatients: uniquePatients.size };

    const html = this.getAttendedPatientsReportHtml(
      clinic,
      professional?.fullName || "Todos",
      specialty?.name || "Todas",
      patientDataList,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 5. Relatório de Contas a Receber
   */
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

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.PaymentInstallmentWhereInput = {
      clinicId: clinicId,
      status: status || { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: startDateObj, lte: endDateObj },
    };

    const installments = await prisma.paymentInstallment.findMany({
      where,
      include: {
        treatmentPlan: {
          select: { patient: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    let totalPending = new Decimal(0);
    let totalOverdue = new Decimal(0);
    for (const inst of installments) {
      if (inst.status === "PENDING") {
        totalPending = totalPending.add(inst.amountDue);
      } else if (inst.status === "OVERDUE") {
        totalOverdue = totalOverdue.add(inst.amountDue);
      }
    }
    const summary = {
      totalPending: totalPending.toNumber(),
      totalOverdue: totalOverdue.toNumber(),
      totalOverall: totalPending.add(totalOverdue).toNumber(),
    };

    const html = this.getAccountsReceivableHtml(
      clinic,
      installments,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 6. Relatório de Contas a Pagar
   */
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

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.ExpenseWhereInput = {
      clinicId: clinicId,
      status: status || { in: ["PENDING", "OVERDUE"] },
      dueDate: { gte: startDateObj, lte: endDateObj },
      categoryId: categoryId || undefined,
      supplierId: supplierId || undefined,
    };

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    let totalPending = new Decimal(0);
    let totalOverdue = new Decimal(0);
    for (const exp of expenses) {
      if (exp.status === "PENDING") {
        totalPending = totalPending.add(exp.amount);
      } else if (exp.status === "OVERDUE") {
        totalOverdue = totalOverdue.add(exp.amount);
      }
    }
    const summary = {
      totalPending: totalPending.toNumber(),
      totalOverdue: totalOverdue.toNumber(),
      totalOverall: totalPending.add(totalOverdue).toNumber(),
    };

    const html = this.getAccountsPayableHtml(
      clinic,
      expenses,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 7. Relatório de Disponibilidade de Estoque
   */
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

    const where: Prisma.ProductWhereInput = {
      clinicId,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
    };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    const productsWithCost: ProductWithCost[] = [];
    let grandTotalValue = new Decimal(0);

    for (const product of products) {
      const unitCost = await this.getProductUnitCost(prisma, product.id);
      const totalValue = unitCost.times(product.currentStock);

      productsWithCost.push({
        ...product,
        unitCost,
        totalValue,
      });
      grandTotalValue = grandTotalValue.add(totalValue);
    }

    const summary = {
      totalValueInStock: grandTotalValue.toNumber(),
      totalItems: products.reduce((acc, p) => acc + p.currentStock, 0),
    };

    const html = this.getStockAvailabilityHtml(
      clinic,
      productsWithCost,
      summary
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 8. Relatório de Movimentação de Estoque
   */
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

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.StockMovementWhereInput = {
      product: { clinicId },
      type,
      date: { gte: startDateObj, lte: endDateObj },
      productId: productId || undefined,
    };

    const movements = await prisma.stockMovement.findMany({
      where,
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
      if (move.totalValue) {
        totalValue = totalValue.add(move.totalValue);
      }
    }
    const summary = {
      totalQuantity,
      totalValue: totalValue.toNumber(),
    };

    const html = this.getStockMovementHtml(
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
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 9. Relatório de Vendas
   */
  static async generateSalesReport(
    clinicId: string,
    filters: z.infer<typeof salesReportQuerySchema>
  ) {
    const { startDate, endDate, sellerId } = filters;
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });
    if (!clinic) throw new Error("Clínica não encontrada.");

    // Correção de fuso horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.TreatmentPlanWhereInput = {
      clinicId,
      createdAt: { gte: startDateObj, lte: endDateObj },
      sellerId: sellerId || undefined,
    };

    const plans = await prisma.treatmentPlan.findMany({
      where,
      include: {
        patient: { select: { name: true } },
        seller: { select: { fullName: true } },
        procedures: {
          include: {
            procedure: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalValue = new Decimal(0);
    for (const plan of plans) {
      totalValue = totalValue.add(plan.total);
    }
    const totalSales = plans.length;
    const avgTicket =
      totalSales > 0 ? totalValue.dividedBy(totalSales) : new Decimal(0);

    const topProcedureAgg = await prisma.treatmentPlanProcedure.groupBy({
      by: ["procedureId"],
      where: { treatmentPlan: where },
      _sum: { contractedSessions: true },
      orderBy: {
        _sum: { contractedSessions: "desc" },
      },
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
        orderBy: {
          _sum: { total: "desc" },
        },
        take: 1,
      });

      if (topSellerAgg.length > 0) {
        const seller = await prisma.user.findUnique({
          where: { id: topSellerAgg[0].sellerId },
          select: { fullName: true },
        });
        topSellerName = `${seller?.fullName} (${this.formatCurrency(
          topSellerAgg[0]._sum.total || 0
        )})`;
      }
    }

    const summary = {
      totalValue: totalValue.toNumber(),
      totalSales: totalSales,
      avgTicket: avgTicket.toNumber(),
      topProcedure: topProcedureName,
      topSeller: topSellerName,
    };

    const html = this.getSalesHtml(
      clinic,
      plans,
      summary,
      startDateObj,
      endDateObj,
      !!sellerId
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 10. Relatório de Formas de Pagamento
   */
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

    // Correção de fuso horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const aggregatedData = await prisma.paymentInstallment.groupBy({
      by: ["paymentMethod"],
      where: {
        clinicId: clinicId,
        status: "PAID",
        paymentDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
      },
      _sum: {
        paidAmount: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          paidAmount: "desc",
        },
      },
    });

    let grandTotal = new Decimal(0);
    for (const group of aggregatedData) {
      grandTotal = grandTotal.add(group._sum.paidAmount || 0);
    }
    const summary = {
      totalReceived: grandTotal.toNumber(),
    };

    const html = this.getPaymentMethodsHtml(
      clinic,
      aggregatedData,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 11. Relatório de Pacientes Inativos
   */
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
        appointments: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    });

    const inactivePatients: ProcessedInactivePatient[] = [];
    for (const p of patients) {
      if (p.appointments.length > 0 && p.appointments[0].date < thresholdDate) {
        inactivePatients.push({
          name: p.name,
          phone: this.formatPhone(p.phones[0]?.number),
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

    const html = this.getInactivePatientsHtml(
      clinic,
      inactivePatients,
      summary
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * 12. Relatório de Extrato de Caixa (Fechamento)
   */
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

    // Correção de Fuso Horário
    const startDateObj = new Date(startDate + "T00:00:00");
    const endDateObj = new Date(endDate + "T23:59:59.999");

    const where: Prisma.FinancialTransactionWhereInput = {
      clinicId,
      date: { gte: startDateObj, lte: endDateObj },
      bankAccountId: bankAccountId || undefined,
      type: type || undefined,
    };

    const transactions = await prisma.financialTransaction.findMany({
      where,
      include: {
        paymentInstallment: {
          select: {
            dueDate: true,
            paymentMethod: true,
            treatmentPlan: {
              select: { patient: { select: { name: true } } },
            },
          },
        },
        expense: {
          select: {
            dueDate: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    });

    // Calcular Resumo
    let totalRevenue = new Decimal(0);
    let totalExpense = new Decimal(0);
    const paymentMethodTotals: Record<string, Decimal> = {};

    for (const t of transactions) {
      if (t.type === "REVENUE") {
        totalRevenue = totalRevenue.add(t.amount);
        const method = t.paymentInstallment?.paymentMethod ?? null;
        const methodName = this.formatPaymentMethod(method);
        if (!paymentMethodTotals[methodName]) {
          paymentMethodTotals[methodName] = new Decimal(0);
        }
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

    const html = this.getCashStatementHtml(
      clinic,
      transactions,
      summary,
      startDateObj,
      endDateObj
    );

    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  // =================================================================================
  // PARTE C: Geradores de HTML (Privados)
  // =================================================================================

  /**
   * HTML: Relatório de Atendimentos
   */
  private static getReportHtml(
    clinic: Partial<Clinic>,
    data: Record<string, AppointmentWithIncludes[]>,
    summary: { totalAppointments: number; totalValue: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let professionalsHtml = "";
    for (const professionalName in data) {
      const appointments = data[professionalName];
      let rowsHtml = "";

      for (const app of appointments) {
        const dateTime = `${format(new Date(app.date), "dd/MM/yyyy", {
          locale: ptBR,
        })} às ${app.startTime}`;
        const procedureName = app.appointmentType.name;
        const value = app.treatmentPlan
          ? this.formatCurrency(app.treatmentPlan.total)
          : "N/A";
        const status = this.getPlanPaymentStatus(app.treatmentPlan);

        rowsHtml += `
          <tr>
            <td>${app.patient.name}</td>
            <td>${dateTime}</td>
            <td>${procedureName}</td>
            <td style="text-align: right;">${value}</td>
            <td>${status}</td>
          </tr>
        `;
      }

      professionalsHtml += `
        <h3 class="professional-name">${professionalName}</h3>
        <table class="appointments-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Data e Hora</th>
              <th>Procedimento</th>
              <th style="text-align: right;">Valor do Plano</th>
              <th>Status Pagto.</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    if (Object.keys(data).length === 0) {
      professionalsHtml =
        "<p>Nenhum atendimento encontrado para o período e filtros selecionados.</p>";
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Atendimentos</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 20px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 11px; color: #555; text-transform: uppercase; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .professional-name { font-size: 14px; color: #4f46e5; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .appointments-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .appointments-table th, .appointments-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
          .appointments-table th { background-color: #f4f4f4; font-weight: bold; }
          .appointments-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Atendimentos</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total de Atendimentos</h4>
            <p>${summary.totalAppointments}</p>
          </div>
          <div class="summary-item">
            <h4>Valor Total (Planos Vinculados)</h4>
            <p>${this.formatCurrency(summary.totalValue)}</p>
          </div>
        </div>
        ${professionalsHtml}
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Valor por Profissional
   */
  private static getProfessionalValueReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    data: FlatProfessionalValueData[],
    summary: { totalValuePaid: number; totalPatients: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 20px;">
            Nenhum pagamento recebido para este profissional no período.
          </td>
        </tr>
      `;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.patientName}</td>
            <td>${item.specialtyName}</td>
            <td>${item.procedureName}</td>
            <td>${item.installmentInfo}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.procedureValue
            )}</td>
            <td>${format(item.dueDate, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${
              item.paymentDate
                ? format(item.paymentDate, "dd/MM/yyyy", { locale: ptBR })
                : "N/A"
            }</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.paidAmount
            )}</td>
            <td>${this.formatPaymentMethod(item.paymentMethod)}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Valor por Profissional</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 9px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .report-header h3 { margin: 5px 0 10px 0; font-size: 14px; color: #4f46e5; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 9px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 5px 7px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Valor por Profissional</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
          <h3>Profissional: ${professionalName}</h3>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total de Pacientes (Únicos)</h4>
            <p>${summary.totalPatients}</p>
          </div>
          <div class="summary-item">
            <h4>Total de Valor Pago</h4>
            <p>${this.formatCurrency(summary.totalValuePaid)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Especialidade</th>
              <th>Procedimento</th>
              <th>Parcela</th>
              <th>Valor (Proc.)</th>
              <th>Vencimento</th>
              <th>Pagamento</th>
              <th>Valor Pago (Parc.)</th>
              <th>Forma Pagto.</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Comissão do Vendedor
   */
  private static getCommissionReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    data: CommissionRecordWithIncludes[],
    summary: { totalPending: number; totalPaid: number; totalOverall: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px;">
            Nenhuma comissão encontrada para este vendedor no período.
          </td>
        </tr>
      `;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${format(item.calculationDate, "dd/MM/yyyy", {
              locale: ptBR,
            })}</td>
            <td>${item.treatmentPlan.patient.name}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.treatmentPlan.total
            )}</td>
            <td style="text-align: right; color: #059669; font-weight: bold;">${this.formatCurrency(
              item.calculatedAmount
            )}</td>
            <td>${this.formatCommissionStatus(item.status)}</td>
            <td>${
              item.paymentDate
                ? format(item.paymentDate, "dd/MM/yyyy", { locale: ptBR })
                : "---"
            }</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Comissão</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .report-header h3 { margin: 5px 0 10px 0; font-size: 14px; color: #4f46e5; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Comissão do Vendedor</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
          <h3>Vendedor: ${professionalName}</h3>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total Pendente</h4>
            <p style="color: #D97706;">${this.formatCurrency(
              summary.totalPending
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Pago</h4>
            <p style="color: #059669;">${this.formatCurrency(
              summary.totalPaid
            )}</p>
          </div>
           <div class="summary-item">
            <h4>Total Gerado (Pend + Pago)</h4>
            <p>${this.formatCurrency(summary.totalOverall)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Data (Cálculo)</th>
              <th>Paciente</th>
              <th>Valor da Venda (Total)</th>
              <th>Valor Comissão (Vendedor)</th>
              <th>Status</th>
              <th>Data Pagto. (Comissão)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Pacientes Atendidos
   */
  private static getAttendedPatientsReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    specialtyName: string,
    data: ProcessedPatient[],
    summary: { totalPatients: number },
    startDate: Date,
    endDate: Date
  ): string {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 20px;">
            Nenhum paciente encontrado para os filtros selecionados.
          </td>
        </tr>
      `;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.name}</td>
            <td>${item.phone}</td>
            <td>${item.cpf}</td>
            <td>${item.specialty}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Pacientes Atendidos</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .report-header h3 { margin: 5px 0 10px 0; font-size: 12px; color: #555; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; width: 200px; margin: 15px auto; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 18px; font-weight: bold; color: #000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Pacientes Atendidos</h2>
          <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
          <h3>Profissional: ${professionalName}</h3>
          <h3>Especialidade: ${specialtyName}</h3>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total de Pacientes Únicos</h4>
            <p>${summary.totalPatients}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Telefone</th>
              <th>CPF</th>
              <th>Especialidade (Plano)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Contas a Receber
   */
  private static getAccountsReceivableHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhuma conta a receber encontrada.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr style="${
            item.status === "OVERDUE"
              ? "color: #D97706; background: #FFFBEB;"
              : ""
          }">
            <td>${format(item.dueDate, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.treatmentPlan.patient.name}</td>
            <td>${`Parcela ${item.installmentNumber}`}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.amountDue
            )}</td>
            <td>${this.formatPaymentStatus(item.status)}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Contas a Receber</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Contas a Receber</h2>
          <p>Período de Vencimento: ${formattedStartDate} até ${formattedEndDate}</p>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total a Vencer</h4>
            <p style="color: #3B82F6;">${this.formatCurrency(
              summary.totalPending
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Vencido</h4>
            <p style="color: #D97706;">${this.formatCurrency(
              summary.totalOverdue
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Geral (A Receber)</h4>
            <p>${this.formatCurrency(summary.totalOverall)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Paciente</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Contas a Pagar
   */
  private static getAccountsPayableHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhuma conta a pagar encontrada.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr style="${
            item.status === "OVERDUE"
              ? "color: #D97706; background: #FFFBEB;"
              : ""
          }">
            <td>${format(item.dueDate, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.description}</td>
            <td>${item.category?.name || "N/A"}</td>
            <td>${item.supplier?.name || "N/A"}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.amount
            )}</td>
            <td>${this.formatPaymentStatus(item.status)}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Contas a Pagar</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .summary-item { text-align: center; }
          .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
          .data-table th { background-color: #f4f4f4; font-weight: bold; }
          .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h2>Relatório de Contas a Pagar</h2>
          <p>Período de Vencimento: ${formattedStartDate} até ${formattedEndDate}</p>
        </div>
        <div class="summary-box">
          <div class="summary-item">
            <h4>Total a Vencer</h4>
            <p style="color: #3B82F6;">${this.formatCurrency(
              summary.totalPending
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Vencido</h4>
            <p style="color: #D97706;">${this.formatCurrency(
              summary.totalOverdue
            )}</p>
          </div>
          <div class="summary-item">
            <h4>Total Geral (A Pagar)</h4>
            <p>${this.formatCurrency(summary.totalOverall)}</p>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Fornecedor</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
    `;
  }

  /**
   * HTML: Relatório de Disponibilidade de Estoque
   */
  private static getStockAvailabilityHtml(
    clinic: Partial<Clinic>,
    data: ProductWithCost[],
    summary: any
  ) {
    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum produto encontrado.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.name}</td>
            <td>${item.category.name}</td>
            <td style="text-align: right;">${item.currentStock}</td>
            <td style="text-align: right;">${this.formatCurrency(
              item.unitCost
            )}</td>
            <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
              item.totalValue
            )}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Disponibilidade de Estoque</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Disponibilidade de Estoque</h2>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Total de Itens em Estoque</h4>
          <p>${summary.totalItems}</p>
        </div>
        <div class="summary-item">
          <h4>Valor Total em Estoque (Custo)</h4>
          <p>${this.formatCurrency(summary.totalValueInStock)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Qtd. Atual</th>
            <th>Custo Unit. (Últ. Entr.)</th>
            <th>Valor Total (Custo)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Movimentação de Estoque
   */
  private static getStockMovementHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    type: StockMovementType,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });
    const title =
      type === "ENTRY"
        ? "Relatório de Entradas de Estoque"
        : "Relatório de Saídas de Estoque";

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhuma movimentação encontrada.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${format(item.date, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.product.name}</td>
            <td style="text-align: right;">${item.quantity}</td>
            <td>${item.supplier?.name || "N/A"}</td>
            <td>${item.notes || ""}</td>
            <td style="text-align: right;">${
              item.totalValue ? this.formatCurrency(item.totalValue) : "R$ 0,00"
            }</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>${title}</h2>
        <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Total de Itens (${type === "ENTRY" ? "Entrada" : "Saída"})</h4>
          <p>${summary.totalQuantity}</p>
        </div>
        <div class="summary-item">
          <h4>Valor Total (${type === "ENTRY" ? "Custo" : "N/A"})</h4>
          <p>${this.formatCurrency(summary.totalValue)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Fornecedor</th>
            <th>Observação</th>
            <th>Valor Total (Entrada)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Vendas
   */
  private static getSalesHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date,
    isFilteredBySeller: boolean
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhuma venda encontrada no período.</td></tr>`;
    } else {
      for (const item of data) {
        const proceduresList = item.procedures
          .map((p: any) => `${p.procedure.name} (${p.contractedSessions}s)`)
          .join("<br>");
        rowsHtml += `
          <tr>
            <td>${format(item.createdAt, "dd/MM/yyyy", { locale: ptBR })}</td>
            <td>${item.patient.name}</td>
            <td>${item.seller.fullName}</td>
            <td>${proceduresList}</td>
            <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
              item.total
            )}</td>
          </tr>
        `;
      }
    }

    const topSellerHtml = isFilteredBySeller
      ? ""
      : `<div class="summary-item">
          <h4>Vendedor Destaque</h4>
          <p>${summary.topSeller}</p>
        </div>`;

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Vendas</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 13px; font-weight: bold; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; white-space: nowrap; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Vendas</h2>
        <p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Valor Total Vendido</h4>
          <p style="color: #059669;">${this.formatCurrency(
            summary.totalValue
          )}</p>
        </div>
        <div class="summary-item">
          <h4>Total de Vendas</h4>
          <p>${summary.totalSales}</p>
        </div>
        <div class="summary-item">
          <h4>Ticket Médio</h4>
          <p>${this.formatCurrency(summary.avgTicket)}</p>
        </div>
        <div class="summary-item">
          <h4>Procedimento Mais Vendido</h4>
          <p>${summary.topProcedure}</p>
        </div>
        ${topSellerHtml}
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data Venda</th>
            <th>Paciente</th>
            <th>Vendedor</th>
            <th>Procedimentos (Sessões)</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Formas de Pagamento
   */
  private static getPaymentMethodsHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="3" style="text-align: center; padding: 20px;">Nenhum pagamento recebido no período.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${this.formatPaymentMethod(item.paymentMethod)}</td>
            <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
              item._sum.paidAmount || 0
            )}</td>
            <td style="text-align: right;">${item._count._all}</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Formas de Pagamento</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; width: 250px; margin: 15px auto; }
        .summary-item { text-align: center; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 16px; font-weight: bold; color: #059669; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Pagamentos por Método</h2>
        <p>Período de Pagamento: ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Valor Total Recebido no Período</h4>
          <p>${this.formatCurrency(summary.totalReceived)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Forma de Pagamento</th>
            <th>Valor Total Recebido</th>
            <th>Qtd. de Pagamentos</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Pacientes Inativos
   */
  private static getInactivePatientsHtml(
    clinic: Partial<Clinic>,
    data: ProcessedInactivePatient[],
    summary: any
  ) {
    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhum paciente inativo há mais de ${summary.daysFilter} dias.</td></tr>`;
    } else {
      for (const item of data) {
        rowsHtml += `
          <tr>
            <td>${item.name}</td>
            <td>${item.phone}</td>
            <td>${format(item.lastAppointment, "dd/MM/yyyy", {
              locale: ptBR,
            })}</td>
            <td style="text-align: right; font-weight: bold;">${
              item.daysInactive
            } dias</td>
          </tr>
        `;
      }
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Pacientes Inativos</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { border: 1px solid #eee; background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; width: 250px; margin: 15px auto; }
        .summary-item h4 { margin: 0 0 5px 0; font-size: 10px; color: #555; text-transform: uppercase; font-weight: normal; }
        .summary-item p { margin: 0; font-size: 16px; font-weight: bold; color: #D97706; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; white-space: nowrap; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; }
        .data-table tbody tr:nth-child(even) { background-color: #fdfdfd; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Pacientes Inativos</h2>
        <p>Pacientes sem agendamentos nos últimos ${summary.daysFilter} dias</p>
      </div>
      <div class="summary-box">
        <div class="summary-item">
          <h4>Total de Pacientes Inativos</h4>
          <p>${summary.totalInactive}</p>
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>Paciente</th><th>Telefone</th><th>Último Agendamento</th><th>Dias Inativo</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }

  /**
   * HTML: Relatório de Extrato de Caixa (Fechamento)
   */
  private static getCashStatementHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ) {
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let rowsHtml = "";
    if (data.length === 0) {
      rowsHtml = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma transação financeira encontrada no período.</td></tr>`;
    } else {
      for (const item of data) {
        let payerOrSupplier = "N/A";
        let dueDate = "N/A";
        let paymentMethod = "N/A";

        if (item.type === "REVENUE" && item.paymentInstallment) {
          payerOrSupplier = item.paymentInstallment.treatmentPlan.patient.name;
          dueDate = format(item.paymentInstallment.dueDate, "dd/MM/yyyy", {
            locale: ptBR,
          });
          paymentMethod = this.formatPaymentMethod(
            item.paymentInstallment.paymentMethod
          );
        } else if (item.type === "EXPENSE" && item.expense) {
          payerOrSupplier = item.expense.supplier?.name || "Despesa Avulsa";
          dueDate = format(item.expense.dueDate, "dd/MM/yyyy", {
            locale: ptBR,
          });
          paymentMethod = "N/A (Saída)";
        } else if (item.type === "TRANSFER") {
          payerOrSupplier = "Transferência Interna";
          paymentMethod = "N/A (Transf.)";
        }

        const isRevenue = item.type === "REVENUE";
        const amountStyle = `font-weight: bold; text-align: right; color: ${
          isRevenue ? "#059669" : "#DC2626"
        };`;
        const amount = `${isRevenue ? "+" : "-"} ${this.formatCurrency(
          item.amount
        )}`;

        rowsHtml += `
          <tr>
            <td>${format(item.date, "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
            <td>${this.formatTransactionType(item.type)}</td>
            <td>${item.description}</td>
            <td>${payerOrSupplier}</td>
            <td>${dueDate}</td>
            <td>${paymentMethod}</td>
            <td style="${amountStyle}">${amount}</td>
          </tr>
        `;
      }
    }

    let paymentBreakdownHtml = "";
    if (
      summary.paymentMethodBreakdown &&
      summary.paymentMethodBreakdown.length > 0
    ) {
      paymentBreakdownHtml = `<div class="breakdown-list">`;
      for (const item of summary.paymentMethodBreakdown) {
        paymentBreakdownHtml += `
          <div class="breakdown-item">
            <span>${item.name}:</span>
            <span>${this.formatCurrency(item.total)}</span>
          </div>
        `;
      }
      paymentBreakdownHtml += `</div>`;
    }

    const netStyle =
      summary.netTotal >= 0 ? "color: #059669;" : "color: #DC2626;";

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Fluxo de Caixa</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 15px; }
        .report-header h2 { margin: 0; font-size: 16px; }
        .report-header p { margin: 2px 0; font-size: 11px; }
        .summary-box { 
          border: 1px solid #eee; background: #f9f9f9; padding: 15px; 
          border-radius: 8px; margin-bottom: 20px; 
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;
        }
        .summary-item { text-align: center; }
        .summary-item h4 { 
          margin: 0 0 5px 0; font-size: 10px; color: #555; 
          text-transform: uppercase; font-weight: normal; 
        }
        .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
        .summary-item.revenue {
          grid-column: span 1;
        }
        .breakdown-list { 
          margin-top: 8px; padding-top: 8px;
          border-top: 1px solid #e5e7eb; 
        }
        .breakdown-item { 
          display: flex; justify-content: space-between; 
          font-size: 9px; color: #374151; 
          margin-bottom: 3px; text-align: left;
        }
        .breakdown-item span:last-child { font-weight: 500; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .data-table th, .data-table td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        .data-table th { background-color: #f4f4f4; font-weight: bold; white-space: nowrap; }
      </style>
    </head><body>
      <div class="report-header">
        <h2>Relatório de Extrato de Caixa</h2>
        <p>Período de Pagamento/Transação: ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item revenue">
          <h4>Total de Entradas (Receitas)</h4>
          <p style="color: #059669;">${this.formatCurrency(
            summary.totalRevenue
          )}</p>
          ${paymentBreakdownHtml}
        </div>
        <div class="summary-item">
          <h4>Total de Saídas (Despesas)</h4>
          <p style="color: #DC2626;">${this.formatCurrency(
            summary.totalExpense
          )}</p>
        </div>
        <div class="summary-item">
          <h4>Saldo do Período (Líquido)</h4>
          <p style="${netStyle}">${this.formatCurrency(summary.netTotal)}</p>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data/Hora (Pgto)</th>
            <th>Tipo</th>
            <th>Descrição (Transação)</th>
            <th>Paciente/Fornecedor</th>
            <th>Data (Venc.)</th>
            <th>Forma Pagto.</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>
    `;
  }
}
