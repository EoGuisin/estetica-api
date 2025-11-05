// src/services/report.service.ts
import { prisma } from "../lib/prisma";
import PdfService from "./pdf.service";
import {
  Appointment,
  Clinic,
  PaymentStatus,
  TreatmentPlan,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale"; // <--- Importação agora será usada

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

export class ReportService {
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
}
