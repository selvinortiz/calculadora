"use client";

import { useMemo, useState } from "react";
import {
  calculatePaymentSchedule,
  type SimpleInterestQuote,
} from "@/lib/finance";
import { PaymentScheduleDocument } from "./payment-schedule-document";
import styles from "./loan-payment-plan.module.css";

type LoanPaymentPlanProps = {
  annualRate: number;
  downPayment: number;
  operatorCompany: string;
  price: number;
  quote: SimpleInterestQuote;
};

type PlanDetails = {
  accountReference: string;
  creditorName: string;
  debtorName: string;
  firstDueDate: string;
  issueDate: string;
};

export function LoanPaymentPlan({
  annualRate,
  downPayment,
  operatorCompany,
  price,
  quote,
}: LoanPaymentPlanProps) {
  const [details, setDetails] = useState<PlanDetails>(() => ({
    accountReference: "",
    creditorName: operatorCompany,
    debtorName: "",
    firstDueDate: "",
    issueDate: getTodayIso(),
  }));
  const [showErrors, setShowErrors] = useState(false);

  const errors = useMemo(
    () => ({
      debtorName: details.debtorName.trim()
        ? undefined
        : "Indica el nombre del deudor.",
      creditorName: details.creditorName.trim()
        ? undefined
        : "Indica el nombre del acreedor.",
      accountReference: details.accountReference.trim()
        ? undefined
        : "Indica el lote o número de cuenta.",
      issueDate: details.issueDate ? undefined : "Indica la fecha de emisión.",
      firstDueDate: details.firstDueDate
        ? undefined
        : "Indica la fecha de la primera cuota.",
    }),
    [details],
  );
  const hasErrors = Object.values(errors).some(Boolean);
  const rows = useMemo(
    () =>
      details.firstDueDate
        ? calculatePaymentSchedule({
            principal: quote.principal,
            interestTotal: quote.interestTotal,
            months: quote.months,
            firstDueDate: details.firstDueDate,
          })
        : [],
    [details.firstDueDate, quote],
  );

  function updateDetails(field: keyof PlanDetails, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function printPlan() {
    setShowErrors(true);
    if (hasErrors) return;
    window.print();
  }

  return (
    <details className={styles.planCard}>
      <summary>
        <span>
          <small>Documento para el deudor</small>
          <strong>Preparar plan de pagos</strong>
          <span>Genera las cuotas con sus fechas de vencimiento.</span>
        </span>
        <span className={styles.summaryAction}>
          <span className={styles.openLabel}>Abrir</span>
          <span className={styles.closeLabel}>Cerrar</span>
        </span>
      </summary>

      <div className={styles.planContent}>
        <div className={styles.heading}>
          <div>
            <p>Plan del préstamo</p>
            <h2>Completa los datos del documento</h2>
          </div>
          <span>{quote.months} cuotas</span>
        </div>

        <form className={styles.form} onSubmit={(event) => event.preventDefault()} noValidate>
          <PlanField
            id="plan-debtor-name"
            label="Nombre del deudor"
            value={details.debtorName}
            onChange={(value) => updateDetails("debtorName", value)}
            error={showErrors ? errors.debtorName : undefined}
          />
          <PlanField
            id="plan-creditor-name"
            label="Acreedor o vendedor"
            value={details.creditorName}
            onChange={(value) => updateDetails("creditorName", value)}
            error={showErrors ? errors.creditorName : undefined}
          />
          <PlanField
            id="plan-account-reference"
            label="Lote o número de cuenta"
            value={details.accountReference}
            onChange={(value) => updateDetails("accountReference", value)}
            error={showErrors ? errors.accountReference : undefined}
          />
          <PlanField
            id="plan-issue-date"
            label="Fecha de emisión"
            type="date"
            value={details.issueDate}
            onChange={(value) => updateDetails("issueDate", value)}
            error={showErrors ? errors.issueDate : undefined}
          />
          <PlanField
            id="plan-first-due-date"
            label="Vencimiento de la primera cuota"
            type="date"
            value={details.firstDueDate}
            onChange={(value) => updateDetails("firstDueDate", value)}
            error={showErrors ? errors.firstDueDate : undefined}
            hint="Las demás fechas se programarán mensualmente."
          />
        </form>

        <div className={styles.actions}>
          <p>
            El plan detalla capital, interés y saldo de cada cuota. No funciona como comprobante de pago.
          </p>
          <button type="button" onClick={printPlan}>
            Imprimir plan o guardar PDF
          </button>
        </div>

        {rows.length > 0 ? (
          <>
            <div className={styles.previewLabel}>Vista previa del plan de pagos</div>
            <PaymentScheduleDocument
              accountReference={details.accountReference}
              annualRate={annualRate}
              creditorName={details.creditorName}
              debtorName={details.debtorName}
              downPayment={downPayment}
              finalPayment={quote.finalPayment}
              interestTotal={quote.interestTotal}
              issueDate={details.issueDate}
              monthlyPayment={quote.monthly}
              originalTermMonths={quote.months}
              price={price}
              principal={quote.principal}
              rows={rows}
              scheduledTotal={quote.total}
              variant="original"
            />
          </>
        ) : (
          <p className={styles.emptyPreview}>
            Indica la primera fecha de vencimiento para ver el calendario completo.
          </p>
        )}
      </div>
    </details>
  );
}

function PlanField({
  error,
  hint,
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
  error?: string;
  hint?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  type?: "date" | "text";
  value: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label} *</label>
      <input
        id={id}
        type={type}
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function getTodayIso(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}
