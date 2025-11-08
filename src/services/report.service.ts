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
  TreatmentPlan,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale"; // <--- Importação agora será usada
import {
  accountsPayableReportQuerySchema,
  accountsReceivableReportQuerySchema,
} from "../schemas/report.schema";
import z from "zod";

// Tipos auxiliares para os dados
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

type ReportFilters = {
  startDate: string;
  endDate: string;
  professionalId?: string;
};

type ProfessionalValueReportFilters = {
  startDate: string;
  endDate: string;
  professionalId: string;
};

type FlatProfessionalValueData = {
  patientName: string;
  specialtyName: string;
  procedureName: string;
  procedureValue: Decimal; // Valor do procedimento
  dueDate: Date; // Vencimento da parcela
  paymentDate: Date | null; // Data do pagamento
  paidAmount: Decimal; // Valor pago na parcela
  paymentMethod: PaymentMethod | null; // Forma de pagamento
  installmentInfo: string; // <-- 1. CAMPO ADICIONADO AO TIPO
};

type CommissionReportFilters = {
  startDate: string;
  endDate: string;
  professionalId: string;
};

type CommissionRecordWithIncludes = CommissionRecord & {
  professional: { fullName: string };
  treatmentPlan: {
    total: Decimal;
    patient: { name: string };
  };
};

type AttendedPatientsReportFilters = {
  startDate: string;
  endDate: string;
  professionalId?: string;
  specialtyId?: string;
};

type ProcessedPatient = {
  name: string;
  cpf: string;
  phone: string;
  specialty: string;
};

export class ReportService {
  /**
   * Gera o Relatório de Valor por Profissional
   */
  static async generateProfessionalValueReport(
    clinicId: string,
    filters: ProfessionalValueReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    // 1. Buscar dados da clínica e do profissional
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

    // 2. Definir datas
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    // 3. Buscar parcelas PAGAS no período, do profissional selecionado
    const installments = await prisma.paymentInstallment.findMany({
      where: {
        clinicId: clinicId,
        status: "PAID",
        paymentDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
        treatmentPlan: {
          sellerId: professionalId,
        },
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
      orderBy: {
        paymentDate: "asc",
      },
    });

    // 4. Processar e achatar os dados
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

    // 5. Calcular Resumo
    const summary = {
      totalValuePaid: totalPaid.toNumber(),
      totalPatients: patientSet.size,
    };

    // 6. Gerar o HTML
    const html = this.getProfessionalValueReportHtml(
      clinic,
      professional.fullName,
      flattenedData,
      summary,
      startDateObj,
      endDateObj
    );

    // 7. Gerar o PDF
    const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
  }

  /**
   * Helper para formatar Forma de Pagamento
   */
  private static formatPaymentMethod(method: PaymentMethod | null): string {
    if (!method) return "N/A";
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
   * Gera o HTML para o Relatório de Valor por Profissional
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
        // 6. LINHA ATUALIZADA COM A NOVA COLUNA
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
          .summary-box {
            border: 1px solid #eee; background: #f9f9f9; padding: 15px;
            border-radius: 8px; margin-bottom: 20px;
            display: flex; justify-content: space-around;
          }
          .summary-item { text-align: center; }
          .summary-item h4 {
            margin: 0 0 5px 0; font-size: 10px; color: #555;
            text-transform: uppercase; font-weight: normal;
          }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .data-table {
            width: 100%; border-collapse: collapse; font-size: 9px;
          }
          .data-table th, .data-table td {
            border: 1px solid #ddd; padding: 5px 7px; text-align: left;
            /* 8. Adicionado para evitar quebra de linha em colunas de data/valor */
            white-space: nowrap; 
          }
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
   * Gera o Relatório de Atendimentos em PDF
   */
  static async generateAppointmentsReport(
    clinicId: string,
    filters: ReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    // 1. Buscar dados da clínica
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true, taxId: true, address: true },
    });

    if (!clinic) {
      throw new Error("Clínica não encontrada.");
    }

    // 2. Definir datas (garantir que endDate cubra o dia inteiro)
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999); // Fim do dia

    // 3. Buscar os agendamentos
    const appointments = (await prisma.appointment.findMany({
      where: {
        patient: { clinicId },
        date: {
          gte: startDateObj,
          lte: endDateObj,
        },
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
            paymentInstallments: {
              select: { status: true },
            },
          },
        },
      },
      orderBy: [
        { professional: { fullName: "asc" } },
        { date: "asc" },
        { startTime: "asc" },
      ],
    })) as AppointmentWithIncludes[];

    // 4. Processar e agrupar dados
    const groupedByProfessional = appointments.reduce((acc, app) => {
      const profName = app.professional.fullName;
      if (!acc[profName]) {
        acc[profName] = [];
      }
      acc[profName].push(app);
      return acc;
    }, {} as Record<string, AppointmentWithIncludes[]>);

    // 5. Calcular Resumo
    // Para o valor total, somamos o valor de CADA plano de tratamento
    // que apareceu nos agendamentos do período.
    // Usamos um Set para evitar somar o mesmo plano múltiplas vezes.
    const uniquePlanIds = new Set<string>();

    // <--- AVISO 1: forEach substituído por for...of
    for (const app of appointments) {
      if (app.treatmentPlanId) {
        uniquePlanIds.add(app.treatmentPlanId);
      }
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

    // 6. Gerar o HTML
    const html = this.getReportHtml(
      clinic,
      groupedByProfessional,
      summary,
      startDateObj,
      endDateObj
    );

    // 7. Gerar o PDF
    const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
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
   * Helper para derivar status de pagamento do plano
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
   * Gera o HTML principal para o PDF
   */
  private static getReportHtml(
    clinic: Partial<Clinic>,
    data: Record<string, AppointmentWithIncludes[]>,
    summary: { totalAppointments: number; totalValue: number },
    startDate: Date,
    endDate: Date
  ): string {
    // <--- AVISO 2: 'ptBR' adicionado ao format()
    const formattedStartDate = format(startDate, "dd/MM/yyyy", {
      locale: ptBR,
    });
    const formattedEndDate = format(endDate, "dd/MM/yyyy", { locale: ptBR });

    let professionalsHtml = "";
    for (const professionalName in data) {
      const appointments = data[professionalName];

      let rowsHtml = "";

      // <--- AVISO 3: forEach substituído por for...of
      for (const app of appointments) {
        // <--- AVISO 4: 'ptBR' adicionado ao format()
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
          body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            color: #333;
          }
          .report-header {
            text-align: center;
            margin-bottom: 20px;
          }
          .report-header h2 {
            margin: 0;
            font-size: 16px;
          }
          .report-header p {
            margin: 2px 0;
            font-size: 11px;
          }
          .summary-box {
            border: 1px solid #eee;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-around;
          }
          .summary-item {
            text-align: center;
          }
          .summary-item h4 {
            margin: 0 0 5px 0;
            font-size: 11px;
            color: #555;
            text-transform: uppercase;
          }
          .summary-item p {
            margin: 0;
            font-size: 14px;
            font-weight: bold;
            color: #000;
          }
          .professional-name {
            font-size: 14px;
            color: #4f46e5;
            margin-top: 20px;
            margin-bottom: 10px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .appointments-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
          }
          .appointments-table th,
          .appointments-table td {
            border: 1px solid #ddd;
            padding: 6px 8px;
            text-align: left;
            vertical-align: top;
          }
          .appointments-table th {
            background-color: #f4f4f4;
            font-weight: bold;
          }
          .appointments-table tbody tr:nth-child(even) {
            background-color: #fdfdfd;
          }
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
   * Gera o Relatório de Comissão do Vendedor
   */
  static async generateCommissionReport(
    clinicId: string,
    filters: CommissionReportFilters
  ) {
    const { startDate, endDate, professionalId } = filters;

    // 1. Buscar dados da clínica e do profissional
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

    // 2. Definir datas (o filtro será na 'calculationDate')
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    // 3. Buscar os registros de comissão
    const records = (await prisma.commissionRecord.findMany({
      where: {
        clinicId: clinicId,
        professionalId: professionalId,
        calculationDate: {
          // Data que a comissão foi gerada
          gte: startDateObj,
          lte: endDateObj,
        },
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
      orderBy: {
        calculationDate: "asc",
      },
    })) as CommissionRecordWithIncludes[];

    // 4. Calcular Resumo
    let totalPending = new Decimal(0);
    let totalPaid = new Decimal(0);

    for (const record of records) {
      if (record.status === CommissionStatus.PAID) {
        totalPaid = totalPaid.add(record.calculatedAmount);
      } else if (record.status === CommissionStatus.PENDING) {
        totalPending = totalPending.add(record.calculatedAmount);
      }
      // Ignoramos CANCELED
    }

    const summary = {
      totalPending: totalPending.toNumber(),
      totalPaid: totalPaid.toNumber(),
      totalOverall: totalPending.add(totalPaid).toNumber(),
    };

    // 5. Gerar o HTML
    const html = this.getCommissionReportHtml(
      clinic,
      professional.fullName,
      records,
      summary,
      startDateObj,
      endDateObj
    );

    // 6. Gerar o PDF
    const pdfBuffer = await PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });

    return pdfBuffer;
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
   * Gera o HTML para o Relatório de Comissão
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
          .summary-box {
            border: 1px solid #eee; background: #f9f9f9; padding: 15px;
            border-radius: 8px; margin-bottom: 20px;
            display: flex; justify-content: space-around;
          }
          .summary-item { text-align: center; }
          .summary-item h4 {
            margin: 0 0 5px 0; font-size: 10px; color: #555;
            text-transform: uppercase; font-weight: normal;
          }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td {
            border: 1px solid #ddd; padding: 6px 8px; text-align: left;
            white-space: nowrap;
          }
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

  private static formatCpf(cpf: string | null | undefined): string {
    if (!cpf) return "N/A";
    // Formata XXX.XXX.XXX-XX
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

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
   * Gera o Relatório de Pacientes Atendidos
   */
  static async generateAttendedPatientsReport(
    clinicId: string,
    filters: AttendedPatientsReportFilters
  ) {
    const { startDate, endDate, professionalId, specialtyId } = filters;

    // 1. Buscar dados da clínica e nomes (APENAS SE FORNECIDOS)
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });

    // Busca o nome do profissional APENAS se o ID foi passado
    const professional = professionalId
      ? await prisma.user.findUnique({
          where: { id: professionalId },
          select: { fullName: true },
        })
      : null; // <-- Será nulo se não for filtrado

    // Busca o nome da especialidade APENAS se o ID foi passado
    const specialty = specialtyId
      ? await prisma.specialty.findUnique({
          where: { id: specialtyId },
          select: { name: true },
        })
      : null; // <-- Será nulo se não for filtrado

    if (!clinic) {
      throw new Error("Clínica não encontrada.");
    }

    // 2. Definir datas
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    // --- 3. ATUALIZAÇÃO DA QUERY DO PRISMA ---
    // Construção de filtros condicionais
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
          some: {
            procedure: {
              specialtyId: specialtyId,
            },
          },
        },
      };
    }
    // --- FIM DA ATUALIZAÇÃO DA QUERY ---

    // 3. Buscar os AGENDAMENTOS que batem com os filtros
    const appointments = await prisma.appointment.findMany({
      where, // <-- Aplicar o objeto 'where' construído
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
        // Incluir especialidade do plano para exibir na tabela
        treatmentPlan: {
          select: {
            procedures: {
              select: {
                procedure: {
                  select: { specialty: { select: { name: true } } },
                },
              },
              take: 1, // Pega a primeira especialidade do plano
            },
          },
        },
      },
    });

    // 4. Processar para obter Pacientes ÚNICOS
    const uniquePatients = new Map<string, ProcessedPatient>();
    for (const app of appointments) {
      if (!uniquePatients.has(app.patient.id)) {
        // Tenta pegar a especialidade do primeiro procedimento do plano
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

    // 5. Calcular Resumo
    const summary = {
      totalPatients: uniquePatients.size,
    };

    // 6. Gerar o HTML
    const html = this.getAttendedPatientsReportHtml(
      clinic,
      professional?.fullName || "Todos", // Passa "Todos" se for nulo
      specialty?.name || "Todas", // Passa "Todas" se for nulo
      patientDataList,
      summary,
      startDateObj,
      endDateObj
    );

    // 7. Gerar o PDF
    return PdfService.generatePdfFromHtml(html, {
      format: "A4",
      displayHeaderFooter: true,
      headerTemplate: this.getPdfHeader(clinic.name),
      footerTemplate: this.getPdfFooter(),
      margin: { top: "80px", bottom: "50px", left: "20px", right: "20px" },
    });
  }

  /**
   * Gera o HTML para o Relatório de Pacientes Atendidos
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
          
          .summary-box {
            border: 1px solid #eee; background: #f9f9f9; padding: 15px;
            border-radius: 8px; margin-bottom: 20px;
            text-align: center; width: 200px; margin: 15px auto;
          }
          .summary-item h4 {
            margin: 0 0 5px 0; font-size: 10px; color: #555;
            text-transform: uppercase; font-weight: normal;
          }
          .summary-item p { margin: 0; font-size: 18px; font-weight: bold; color: #000; }
          
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td {
            border: 1px solid #ddd; padding: 6px 8px; text-align: left;
            white-space: nowrap;
          }
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

  // --- NOVO RELATÓRIO: CONTAS A RECEBER ---
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

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const where: Prisma.PaymentInstallmentWhereInput = {
      clinicId: clinicId,
      status: status ? status : { in: ["PENDING", "OVERDUE"] },
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

    // Calcular Resumo
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

  // --- RELATÓRIO: CONTAS A PAGAR (COM ESTILO CORRIGIDO) ---
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

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999);

    const where: Prisma.ExpenseWhereInput = {
      clinicId: clinicId,
      status: status ? status : { in: ["PENDING", "OVERDUE"] },
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

    // Calcular Resumo
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

  // --- HTML para A RECEBER (ESTILO CORRIGIDO) ---
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
          .summary-box {
            border: 1px solid #eee; background: #f9f9f9; padding: 15px;
            border-radius: 8px; margin-bottom: 20px;
            display: flex; justify-content: space-around;
          }
          .summary-item { text-align: center; }
          .summary-item h4 {
            margin: 0 0 5px 0; font-size: 10px; color: #555;
            text-transform: uppercase; font-weight: normal;
          }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td {
            border: 1px solid #ddd; padding: 6px 8px; text-align: left;
            white-space: nowrap;
          }
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

  // --- HTML para A PAGAR (ESTILO CORRIGIDO) ---
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
        {/* --- MUDEI AQUI --- */}
        <style>
          body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
          .report-header { text-align: center; margin-bottom: 15px; }
          .report-header h2 { margin: 0; font-size: 16px; }
          .report-header p { margin: 2px 0; font-size: 11px; }
          .summary-box {
            border: 1px solid #eee; background: #f9f9f9; padding: 15px;
            border-radius: 8px; margin-bottom: 20px;
            display: flex; justify-content: space-around;
          }
          .summary-item { text-align: center; }
          .summary-item h4 {
            margin: 0 0 5px 0; font-size: 10px; color: #555;
            text-transform: uppercase; font-weight: normal;
          }
          .summary-item p { margin: 0; font-size: 14px; font-weight: bold; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
          .data-table th, .data-table td {
            border: 1px solid #ddd; padding: 6px 8px; text-align: left;
            white-space: nowrap;
          }
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
}
