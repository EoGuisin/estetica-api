// src/services/report.template.ts
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clinic,
  PaymentMethod,
  PaymentStatus,
  CommissionStatus,
  TransactionType,
  StockMovementType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  AppointmentWithIncludes,
  FlatProfessionalValueData,
  CommissionRecordWithIncludes,
  ProcessedPatient,
  ProductWithCost,
  ProcessedInactivePatient,
} from "./report.service";

export class ReportTemplateService {
  // =================================================================================
  // HELPERS DE SEGURANÇA E FORMATAÇÃO
  // =================================================================================

  /**
   * Previne ataques XSS (Injeção de código malicioso no PDF)
   */
  public static escapeHtml(unsafe: string | null | undefined): string {
    if (!unsafe) return "";
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  public static getPdfHeader(clinicName: string, reportTitle?: string): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 10px; text-align: center; border-bottom: 1px solid #ccc; padding: 10px; width: 100%;">
        <h1 style="margin: 0; font-size: 14px;">${this.escapeHtml(
          clinicName
        )}</h1>
        ${
          reportTitle
            ? `<p style="margin: 2px 0 0 0; font-size: 10px; color: #666;">${this.escapeHtml(
                reportTitle
              )}</p>`
            : ""
        }
      </div>
    `;
  }

  public static getPdfFooter(): string {
    return `
      <div style="font-family: Arial, sans-serif; font-size: 8px; text-align: right; width: 100%; padding: 0 20px;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>
    `;
  }

  public static formatCurrency(value: number | Decimal): string {
    const numValue = typeof value === "number" ? value : value.toNumber();
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numValue);
  }

  public static formatPaymentMethod(
    method: PaymentMethod | null | string
  ): string {
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
        return String(method);
    }
  }

  public static formatPaymentStatus(status: PaymentStatus): string {
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

  public static formatCommissionStatus(status: CommissionStatus): string {
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

  public static formatTransactionType(type: TransactionType | string): string {
    switch (type) {
      case "REVENUE":
        return "Entrada (Receita)";
      case "EXPENSE":
        return "Saída (Despesa)";
      case "TRANSFER":
        return "Transferência";
      default:
        return String(type);
    }
  }

  public static getPlanPaymentStatus(
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

  // =================================================================================
  // TEMPLATES DE RELATÓRIO
  // =================================================================================

  public static getAppointmentsReportHtml(
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
        })} às ${this.escapeHtml(app.startTime)}`;
        const procedureName = app.appointmentType.name;

        // Categoria adicionada aqui conforme o seu Ponto 3
        const categoryLabel =
          (app as any).category === "EVALUATION"
            ? "Avaliação"
            : (app as any).category === "RETURN"
            ? "Retorno"
            : "Sessão";

        const value = app.treatmentPlan
          ? this.formatCurrency(app.treatmentPlan.total)
          : "N/A";
        const status = this.getPlanPaymentStatus(app.treatmentPlan);

        rowsHtml += `
          <tr>
            <td>${this.escapeHtml(app.patient.name)}</td>
            <td>${dateTime}</td>
            <td>
              ${this.escapeHtml(procedureName)} <br/>
              <span style="font-size: 8px; color: #666; background: #eee; padding: 2px 4px; border-radius: 4px;">
                ${categoryLabel}
              </span>
            </td>
            <td style="text-align: right;">${value}</td>
            <td>${status}</td>
          </tr>
        `;
      }

      professionalsHtml += `
        <h3 class="professional-name">${this.escapeHtml(professionalName)}</h3>
        <table class="appointments-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Data e Hora</th>
              <th>Procedimento/Tipo</th>
              <th style="text-align: right;">Valor do Plano</th>
              <th>Status Pagto.</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
    }

    if (Object.keys(data).length === 0) {
      professionalsHtml =
        "<p>Nenhum atendimento encontrado para o período e filtros selecionados.</p>";
    }

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Atendimentos</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; }
        .report-header { text-align: center; margin-bottom: 20px; }
        .report-header h2 { margin: 0; font-size: 16px; }
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
    </head><body>
      <div class="report-header">
        <h2>Relatório de Atendimentos</h2><p>Período de ${formattedStartDate} até ${formattedEndDate}</p>
      </div>
      <div class="summary-box">
        <div class="summary-item"><h4>Total de Atendimentos</h4><p>${
          summary.totalAppointments
        }</p></div>
        <div class="summary-item"><h4>Valor Total (Planos Vinculados)</h4><p>${this.formatCurrency(
          summary.totalValue
        )}</p></div>
      </div>
      ${professionalsHtml}
    </body></html>`;
  }

  public static getProfessionalValueReportHtml(
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

    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="9" style="text-align: center; padding: 20px;">Nenhum pagamento recebido no período.</td></tr>`
        : data
            .map(
              (item) => `
        <tr>
          <td>${this.escapeHtml(item.patientName)}</td>
          <td>${this.escapeHtml(item.specialtyName)}</td>
          <td>${this.escapeHtml(item.procedureName)}</td>
          <td>${this.escapeHtml(item.installmentInfo)}</td>
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
        </tr>`
            )
            .join("");

    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Valor por Profissional</title>
      <style>/* Mesmos estilos globais, omitidos por brevidade */ body{font-family:Arial;font-size:9px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:5px;} th{background:#f4f4f4;} .summary-box{display:flex;justify-content:space-around;background:#f9f9f9;padding:15px;margin-bottom:20px;text-align:center;}</style>
    </head><body>
      <div style="text-align:center; margin-bottom:15px;">
        <h2>Relatório de Valor por Profissional</h2>
        <p>Período: ${formattedStartDate} até ${formattedEndDate}</p>
        <h3 style="color:#4f46e5;">Profissional: ${this.escapeHtml(
          professionalName
        )}</h3>
      </div>
      <div class="summary-box">
        <div><h4>Total de Pacientes (Únicos)</h4><h2>${
          summary.totalPatients
        }</h2></div>
        <div><h4>Total de Valor Pago</h4><h2>${this.formatCurrency(
          summary.totalValuePaid
        )}</h2></div>
      </div>
      <table>
        <thead><tr><th>Paciente</th><th>Especialidade</th><th>Procedimento</th><th>Parcela</th><th>Valor (Proc.)</th><th>Vencimento</th><th>Pagamento</th><th>Valor Pago (Parc.)</th><th>Forma Pagto.</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body></html>`;
  }

  public static getCommissionReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    data: CommissionRecordWithIncludes[],
    summary: any,
    startDate: Date,
    endDate: Date
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="6" style="text-align: center;">Nenhuma comissão.</td></tr>`
        : data
            .map(
              (item) => `
        <tr>
          <td>${format(item.calculationDate, "dd/MM/yyyy")}</td>
          <td>${this.escapeHtml(item.treatmentPlan.patient.name)}</td>
          <td style="text-align: right;">${this.formatCurrency(
            item.treatmentPlan.total
          )}</td>
          <td style="text-align: right; color: #059669; font-weight: bold;">${this.formatCurrency(
            item.calculatedAmount
          )}</td>
          <td>${this.formatCommissionStatus(item.status)}</td>
          <td>${
            item.paymentDate ? format(item.paymentDate, "dd/MM/yyyy") : "---"
          }</td>
        </tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;} .summary-box{display:flex;justify-content:space-around;background:#f9f9f9;padding:15px;margin-bottom:20px;text-align:center;}</style></head><body>
      <div style="text-align:center;"><h2>Relatório de Comissão</h2><p>Vendedor: ${this.escapeHtml(
        professionalName
      )} | ${format(startDate, "dd/MM/yyyy")} até ${format(
      endDate,
      "dd/MM/yyyy"
    )}</p></div>
      <div class="summary-box">
        <div><h4>Pendente</h4><h2 style="color:#D97706;">${this.formatCurrency(
          summary.totalPending
        )}</h2></div>
        <div><h4>Pago</h4><h2 style="color:#059669;">${this.formatCurrency(
          summary.totalPaid
        )}</h2></div>
        <div><h4>Total Gerado</h4><h2>${this.formatCurrency(
          summary.totalOverall
        )}</h2></div>
      </div>
      <table><thead><tr><th>Cálculo</th><th>Paciente</th><th>Venda Total</th><th>Comissão</th><th>Status</th><th>Pagto Comissão</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getAttendedPatientsReportHtml(
    clinic: Partial<Clinic>,
    professionalName: string,
    specialtyName: string,
    data: ProcessedPatient[],
    summary: any,
    startDate: Date,
    endDate: Date
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="4" style="text-align: center;">Nenhum paciente.</td></tr>`
        : data
            .map(
              (item) => `
        <tr><td>${this.escapeHtml(item.name)}</td><td>${this.escapeHtml(
                item.phone
              )}</td><td>${this.escapeHtml(item.cpf)}</td><td>${this.escapeHtml(
                item.specialty
              )}</td></tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;}</style></head><body>
      <div style="text-align:center;"><h2>Pacientes Atendidos</h2><p>Prof: ${this.escapeHtml(
        professionalName
      )} | Esp: ${this.escapeHtml(specialtyName)}<br>${format(
      startDate,
      "dd/MM/yyyy"
    )} até ${format(endDate, "dd/MM/yyyy")}</p></div>
      <div style="text-align:center; padding:10px; background:#eee; margin-bottom:10px;"><h4>Total de Pacientes Únicos: ${
        summary.totalPatients
      }</h4></div>
      <table><thead><tr><th>Paciente</th><th>Telefone</th><th>CPF</th><th>Especialidade (Plano)</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getAccountsReceivableHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="5" style="text-align: center;">Nenhuma conta a receber.</td></tr>`
        : data
            .map(
              (item) => `
        <tr style="${
          item.status === "OVERDUE"
            ? "color: #D97706; background: #FFFBEB;"
            : ""
        }">
          <td>${format(item.dueDate, "dd/MM/yyyy")}</td>
          <td>${this.escapeHtml(item.treatmentPlan.patient.name)}</td>
          <td>Parcela ${item.installmentNumber}</td>
          <td style="text-align: right;">${this.formatCurrency(
            item.amountDue
          )}</td>
          <td>${this.formatPaymentStatus(item.status)}</td>
        </tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;} .summary-box{display:flex;justify-content:space-around;background:#f9f9f9;padding:15px;margin-bottom:20px;text-align:center;}</style></head><body>
      <div style="text-align:center;"><h2>Contas a Receber</h2><p>Vencimento: ${format(
        startDate,
        "dd/MM/yyyy"
      )} até ${format(endDate, "dd/MM/yyyy")}</p></div>
      <div class="summary-box">
        <div><h4>A Vencer</h4><h2 style="color:#3B82F6;">${this.formatCurrency(
          summary.totalPending
        )}</h2></div>
        <div><h4>Vencido</h4><h2 style="color:#D97706;">${this.formatCurrency(
          summary.totalOverdue
        )}</h2></div>
        <div><h4>Geral</h4><h2>${this.formatCurrency(
          summary.totalOverall
        )}</h2></div>
      </div>
      <table><thead><tr><th>Vencimento</th><th>Paciente</th><th>Descrição</th><th>Valor</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getAccountsPayableHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="6" style="text-align: center;">Nenhuma conta a pagar.</td></tr>`
        : data
            .map(
              (item) => `
        <tr style="${
          item.status === "OVERDUE"
            ? "color: #D97706; background: #FFFBEB;"
            : ""
        }">
          <td>${format(item.dueDate, "dd/MM/yyyy")}</td>
          <td>${this.escapeHtml(item.description)}</td>
          <td>${this.escapeHtml(item.category?.name || "N/A")}</td>
          <td>${this.escapeHtml(item.supplier?.name || "N/A")}</td>
          <td style="text-align: right;">${this.formatCurrency(
            item.amount
          )}</td>
          <td>${this.formatPaymentStatus(item.status)}</td>
        </tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;} .summary-box{display:flex;justify-content:space-around;background:#f9f9f9;padding:15px;margin-bottom:20px;text-align:center;}</style></head><body>
      <div style="text-align:center;"><h2>Contas a Pagar</h2><p>Vencimento: ${format(
        startDate,
        "dd/MM/yyyy"
      )} até ${format(endDate, "dd/MM/yyyy")}</p></div>
      <div class="summary-box">
        <div><h4>A Vencer</h4><h2 style="color:#3B82F6;">${this.formatCurrency(
          summary.totalPending
        )}</h2></div>
        <div><h4>Vencido</h4><h2 style="color:#D97706;">${this.formatCurrency(
          summary.totalOverdue
        )}</h2></div>
        <div><h4>Geral</h4><h2>${this.formatCurrency(
          summary.totalOverall
        )}</h2></div>
      </div>
      <table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Fornecedor</th><th>Valor</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getStockAvailabilityHtml(
    clinic: Partial<Clinic>,
    data: ProductWithCost[],
    summary: any
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="5" style="text-align: center;">Estoque vazio.</td></tr>`
        : data
            .map(
              (item) => `
        <tr>
          <td>${this.escapeHtml(item.name)}</td>
          <td>${this.escapeHtml(item.category.name)}</td>
          <td style="text-align: right;">${item.currentStock}</td>
          <td style="text-align: right;">${this.formatCurrency(
            item.unitCost
          )}</td>
          <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
            item.totalValue
          )}</td>
        </tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;} .summary-box{display:flex;justify-content:space-around;background:#f9f9f9;padding:15px;margin-bottom:20px;text-align:center;}</style></head><body>
      <div style="text-align:center;"><h2>Disponibilidade de Estoque</h2></div>
      <div class="summary-box">
        <div><h4>Total Itens</h4><h2>${summary.totalItems}</h2></div>
        <div><h4>Valor Total (Custo)</h4><h2>${this.formatCurrency(
          summary.totalValueInStock
        )}</h2></div>
      </div>
      <table><thead><tr><th>Produto</th><th>Categoria</th><th>Qtd. Atual</th><th>Custo Unit.</th><th>Valor Total (Custo)</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getStockMovementHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    type: StockMovementType,
    startDate: Date,
    endDate: Date
  ): string {
    const title =
      type === "ENTRY" ? "Entradas de Estoque" : "Saídas de Estoque";
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="6" style="text-align: center;">Sem movimentações.</td></tr>`
        : data
            .map(
              (item) => `
        <tr>
          <td>${format(item.date, "dd/MM/yyyy")}</td>
          <td>${this.escapeHtml(item.product.name)}</td>
          <td style="text-align: right;">${item.quantity}</td>
          <td>${this.escapeHtml(item.supplier?.name || "N/A")}</td>
          <td>${this.escapeHtml(item.notes || "")}</td>
          <td style="text-align: right;">${
            item.totalValue ? this.formatCurrency(item.totalValue) : "R$ 0,00"
          }</td>
        </tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;} .summary-box{display:flex;justify-content:space-around;background:#f9f9f9;padding:15px;margin-bottom:20px;text-align:center;}</style></head><body>
      <div style="text-align:center;"><h2>${title}</h2><p>${format(
      startDate,
      "dd/MM/yyyy"
    )} até ${format(endDate, "dd/MM/yyyy")}</p></div>
      <div class="summary-box">
        <div><h4>Qtd. Itens</h4><h2>${summary.totalQuantity}</h2></div>
        <div><h4>Valor Total</h4><h2>${this.formatCurrency(
          summary.totalValue
        )}</h2></div>
      </div>
      <table><thead><tr><th>Data</th><th>Produto</th><th>Quantidade</th><th>Fornecedor</th><th>Observação</th><th>Valor (Entrada)</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getSalesHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date,
    isFilteredBySeller: boolean,
    reportTitle: string
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="5" style="text-align: center;">Nenhuma venda.</td></tr>`
        : data
            .map((item) => {
              const proceduresList = item.procedures
                .map(
                  (p: any) =>
                    `${this.escapeHtml(p.procedure.name)} (${
                      p.contractedSessions
                    }s)`
                )
                .join("<br>");
              return `<tr>
          <td>${format(item.createdAt, "dd/MM/yyyy")}</td>
          <td>${this.escapeHtml(item.patient.name)}</td>
          <td>${this.escapeHtml(item.seller.fullName)}</td>
          <td>${proceduresList}</td>
          <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
            item.total
          )}</td>
        </tr>`;
            })
            .join("");
    const topSellerHtml = isFilteredBySeller
      ? ""
      : `<div><h4>Vendedor Destaque</h4><p>${this.escapeHtml(
          summary.topSeller
        )}</p></div>`;
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;vertical-align:top;} th{background:#f4f4f4;} .summary-box{display:flex;flex-wrap:wrap;justify-content:space-around;background:#f9f9f9;padding:15px;margin-bottom:20px;text-align:center;} .summary-box div{margin:0 10px;} .summary-box p{font-size:13px; font-weight:bold; margin:0;}</style></head><body>
      <div style="text-align:center;"><h2>${this.escapeHtml(
        reportTitle
      )}</h2><p>${format(startDate, "dd/MM/yyyy")} até ${format(
      endDate,
      "dd/MM/yyyy"
    )}</p></div>
      <div class="summary-box">
        <div><h4>Valor Vendido</h4><p style="color:#059669;">${this.formatCurrency(
          summary.totalValue
        )}</p></div>
        <div><h4>Total Vendas</h4><p>${summary.totalSales}</p></div>
        <div><h4>Ticket Médio</h4><p>${this.formatCurrency(
          summary.avgTicket
        )}</p></div>
        <div><h4>Proced. Mais Vendido</h4><p>${this.escapeHtml(
          summary.topProcedure
        )}</p></div>
        ${topSellerHtml}
      </div>
      <table><thead><tr><th>Data Venda</th><th>Paciente</th><th>Vendedor</th><th>Procedimentos (Sessões)</th><th>Valor Total</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getPaymentMethodsHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="3" style="text-align: center;">Sem pagamentos.</td></tr>`
        : data
            .map(
              (item) => `
        <tr>
          <td>${this.formatPaymentMethod(item.paymentMethod)}</td>
          <td style="text-align: right; font-weight: bold;">${this.formatCurrency(
            item._sum.paidAmount || 0
          )}</td>
          <td style="text-align: right;">${item._count._all}</td>
        </tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;}</style></head><body>
      <div style="text-align:center;"><h2>Pagamentos por Método</h2><p>${format(
        startDate,
        "dd/MM/yyyy"
      )} até ${format(endDate, "dd/MM/yyyy")}</p></div>
      <div style="text-align:center; padding:15px; background:#f9f9f9; margin-bottom:20px;"><h4>Total Recebido:</h4> <h2 style="color:#059669;margin:0;">${this.formatCurrency(
        summary.totalReceived
      )}</h2></div>
      <table><thead><tr><th>Forma de Pagamento</th><th>Valor Total Recebido</th><th>Qtd. de Pagamentos</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getInactivePatientsHtml(
    clinic: Partial<Clinic>,
    data: ProcessedInactivePatient[],
    summary: any
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="4" style="text-align: center;">Nenhum inativo.</td></tr>`
        : data
            .map(
              (item) => `
        <tr><td>${this.escapeHtml(item.name)}</td><td>${this.escapeHtml(
                item.phone
              )}</td><td>${format(
                item.lastAppointment,
                "dd/MM/yyyy"
              )}</td><td style="text-align: right; font-weight: bold;">${
                item.daysInactive
              } dias</td></tr>`
            )
            .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;}</style></head><body>
      <div style="text-align:center;"><h2>Pacientes Inativos (+${summary.daysFilter} dias)</h2></div>
      <div style="text-align:center; padding:15px; background:#f9f9f9; margin-bottom:20px;"><h4>Total Inativos: ${summary.totalInactive}</h4></div>
      <table><thead><tr><th>Paciente</th><th>Telefone</th><th>Último Agendamento</th><th>Dias Inativo</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getCashStatementHtml(
    clinic: Partial<Clinic>,
    data: any[],
    summary: any,
    startDate: Date,
    endDate: Date
  ): string {
    let rowsHtml =
      data.length === 0
        ? `<tr><td colspan="7" style="text-align: center;">Nenhuma transação.</td></tr>`
        : data
            .map((item) => {
              let payerOrSupplier = "N/A",
                dueDate = "N/A",
                paymentMethod = "N/A";
              if (item.type === "REVENUE" && item.paymentInstallment) {
                payerOrSupplier =
                  item.paymentInstallment.treatmentPlan.patient.name;
                dueDate = format(item.paymentInstallment.dueDate, "dd/MM/yyyy");
                paymentMethod = this.formatPaymentMethod(
                  item.paymentInstallment.paymentMethod
                );
              } else if (item.type === "EXPENSE" && item.expense) {
                payerOrSupplier =
                  item.expense.supplier?.name || "Despesa Avulsa";
                dueDate = format(item.expense.dueDate, "dd/MM/yyyy");
                paymentMethod = "N/A (Saída)";
              } else if (item.type === "TRANSFER") {
                payerOrSupplier = "Transferência Interna";
              }
              const isRev = item.type === "REVENUE";
              return `<tr>
          <td>${format(item.date, "dd/MM/yyyy HH:mm")}</td>
          <td>${this.formatTransactionType(item.type)}</td>
          <td>${this.escapeHtml(item.description)}</td>
          <td>${this.escapeHtml(payerOrSupplier)}</td>
          <td>${dueDate}</td>
          <td>${paymentMethod}</td>
          <td style="font-weight: bold; text-align: right; color: ${
            isRev ? "#059669" : "#DC2626"
          };">${isRev ? "+" : "-"} ${this.formatCurrency(item.amount)}</td>
        </tr>`;
            })
            .join("");

    const paymentBreakdownHtml =
      summary.paymentMethodBreakdown
        ?.map(
          (i: any) =>
            `<div style="display:flex; justify-content:space-between; font-size:9px;"><span>${
              i.name
            }:</span><span>${this.formatCurrency(i.total)}</span></div>`
        )
        .join("") || "";

    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;} .summary-box{display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; background:#f9f9f9; padding:15px; margin-bottom:20px; text-align:center;} .summary-box h4{margin:0 0 5px; font-size:10px; color:#555;} .summary-box p{margin:0; font-size:14px; font-weight:bold;}</style></head><body>
      <div style="text-align:center;"><h2>Extrato de Caixa</h2><p>${format(
        startDate,
        "dd/MM/yyyy"
      )} até ${format(endDate, "dd/MM/yyyy")}</p></div>
      <div class="summary-box">
        <div><h4>Total Entradas</h4><p style="color:#059669;">${this.formatCurrency(
          summary.totalRevenue
        )}</p><div style="border-top:1px solid #ddd; margin-top:5px; padding-top:5px;">${paymentBreakdownHtml}</div></div>
        <div><h4>Total Saídas</h4><p style="color:#DC2626;">${this.formatCurrency(
          summary.totalExpense
        )}</p></div>
        <div><h4>Saldo Líquido</h4><p style="color:${
          summary.netTotal >= 0 ? "#059669" : "#DC2626"
        };">${this.formatCurrency(summary.netTotal)}</p></div>
      </div>
      <table><thead><tr><th>Data/Hora (Pgto)</th><th>Tipo</th><th>Descrição</th><th>Paciente/Fornec.</th><th>Vencimento</th><th>Forma Pagto.</th><th>Valor</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>`;
  }

  public static getExpiredProductsHtml(
    clinic: any,
    entries: any[],
    refDate: Date
  ): string {
    let rows = entries
      .map(
        (move) => `<tr>
      <td>${this.escapeHtml(move.product.name)}</td>
      <td>${this.escapeHtml(move.product.category.name)}</td>
      <td>${move.quantity}</td>
      <td style="color: red; font-weight: bold;">${format(
        move.expiryDate,
        "dd/MM/yyyy"
      )}</td>
      <td>${this.escapeHtml(move.invoiceNumber || "N/A")}</td>
    </tr>`
      )
      .join("");
    return `<!DOCTYPE html><html><head><style>body{font-family:Arial;font-size:10px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:6px;} th{background:#f4f4f4;}</style></head><body>
      <div style="text-align:center;"><h2>Produtos Vencidos</h2><p>Data de Referência: ${format(
        refDate,
        "dd/MM/yyyy"
      )}</p></div>
      <table><thead><tr><th>Produto</th><th>Categoria</th><th>Qtd Entrou</th><th>Vencimento</th><th>NF</th></tr></thead><tbody>${
        rows ||
        '<tr><td colspan="5" style="text-align:center;">Nenhum produto vencido.</td></tr>'
      }</tbody></table>
    </body></html>`;
  }
}
