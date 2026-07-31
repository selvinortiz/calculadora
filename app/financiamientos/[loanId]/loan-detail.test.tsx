import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { LoanDetail } from "./loan-detail";

type Loan = ComponentProps<typeof LoanDetail>["loan"];

const installment = { paymentNumber: 7, dueDate: "2026-08-20", principal: 755.56, interest: 238, payment: 993.56, remainingPrincipal: 40_044.42 };

function transaction(id: string, type: string, documentNumber: string, payload: Record<string, unknown>): Loan["transactions"][number] {
  return {
    id,
    type,
    status: "posted",
    effectiveDate: "2026-07-31",
    documentNumber,
    createdAt: "2026-07-31T12:00:00Z",
    voidedAt: null,
    voidReason: null,
    replacesTransactionId: null,
    documents: [{ kind: type === "loan_origination" ? "payment_schedule" : type === "capital_payment" ? "capital_payment_record" : "payment_adjustment_record", snapshot_version: 1, calculation_version: "simple-interest-v2-cents", issued_on: "2026-07-31", snapshot: { organizationName: "Créditos Local", customerName: "María Ortiz", accountReference: "40", payload } }],
  };
}

function loan(transactions: Loan["transactions"]): Loan {
  return {
    id: "loan-1",
    accountReference: "40",
    price: 65_000,
    downPayment: 13_000,
    originalPrincipal: 52_000,
    annualRate: 7,
    termMonths: 60,
    firstDueDate: "2026-01-20",
    status: "active",
    version: 3,
    customer: { name: "María Ortiz" },
    schedule: { versionNumber: 2, reason: "capital_payment", calculationVersion: "simple-interest-v2-cents", principal: 40_799.98, futureInterest: 12_851.99, remainingMonths: 54, regularPayment: 993.56, finalPayment: 993.29, firstPaymentNumber: 7, firstDueDate: "2026-08-20" },
    installments: [installment],
    transactions,
  };
}

describe("LoanDetail", () => {
  it("starts an extended history as a compact map", () => {
    const markup = renderToStaticMarkup(<LoanDetail role="owner" loan={loan([
      transaction("origination", "loan_origination", "FIN-000002", { principal: 52_000, termMonths: 60, schedule: [installment] }),
      transaction("capital", "capital_payment", "REC-000002", { details: { capitalPayment: 6_000, newCapital: 40_799.98 }, revisedSchedule: [installment] }),
      transaction("adjustment", "payment_adjustment", "AJU-000002", { adjustment: { paymentNumber: 7, creditBalance: 41.44, adjustedNextPayment: 952.12 } }),
    ])} />);

    expect(markup).toContain("Historia del financiamiento");
    expect(markup).toContain("Nuevo plan de 1 cuota");
    expect(markup).toContain("Cuota 7 · Saldo a favor");
    expect(markup).toContain("41.44");
    expect(markup).toContain("Cuota 7 registrada");
    expect(markup).toContain("Cuota 8: recibir");
    expect(markup).toContain("Próxima cuota");
    expect(markup).toContain("Mostrar todo");
    expect(markup).not.toContain("<table");
  });

  it("keeps the basic single-transaction record open", () => {
    const markup = renderToStaticMarkup(<LoanDetail role="owner" loan={loan([
      transaction("origination", "loan_origination", "FIN-000002", { principal: 52_000, termMonths: 60, schedule: [installment] }),
    ])} />);

    expect(markup).toContain("Ocultar cuotas");
    expect(markup).toContain("Ocultar detalle");
    expect(markup).toContain("<table");
  });
});
