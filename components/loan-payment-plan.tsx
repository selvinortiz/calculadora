"use client";

import { useMemo, useRef, useState } from "react";
import {
  calculatePaymentSchedule,
  type SimpleInterestQuote,
} from "@/lib/finance";
import { PaymentScheduleDocument } from "./payment-schedule-document";
import { printElement } from "../lib/print-preview";
import { SavedCustomerPicker } from "./saved-profile-picker";
import { notifyDurableDirectoryChanged, useDurableDirectory } from "@/lib/use-durable-directory";
import type { MutationResult, PostedTransaction } from "@/lib/domain";
import styles from "./loan-payment-plan.module.css";

type LoanPaymentPlanProps = {
  annualRate: number;
  downPayment: number;
  onBack: () => void;
  operatorCompany: string;
  price: number;
  quote: SimpleInterestQuote;
  initialDetails: {
    accountReference: string;
    creditorName: string;
    customerId: string;
    debtorName: string;
    firstDueDate: string;
  };
  storageScope: string;
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
  onBack,
  operatorCompany,
  price,
  quote,
  initialDetails,
  storageScope,
}: LoanPaymentPlanProps) {
  const { data } = useDurableDirectory();
  const idempotencyKey = useRef<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialDetails.customerId,
  );
  const [details, setDetails] = useState<PlanDetails>(() => ({
    accountReference: initialDetails.accountReference,
    creditorName: initialDetails.creditorName,
    debtorName: initialDetails.debtorName,
    firstDueDate: initialDetails.firstDueDate,
    issueDate: getTodayIso(),
  }));
  const [showErrors, setShowErrors] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postMessage, setPostMessage] = useState("");
  const [posted, setPosted] = useState<PostedTransaction | null>(null);
  const creditorName =
    details.creditorName || data.organization?.name || operatorCompany;

  const errors = useMemo(
    () => ({
      debtorName: details.debtorName.trim()
        ? undefined
        : "Indica el nombre del deudor.",
      creditorName: creditorName.trim()
        ? undefined
        : "Indica el nombre del acreedor.",
      accountReference: details.accountReference.trim()
        ? undefined
        : "Indica el lote o número de cuenta.",
      issueDate: details.issueDate ? undefined : "Indica la fecha de emisión.",
      firstDueDate: details.firstDueDate
        ? undefined
        : "Indica la fecha de la primera cuota.",
      customer: selectedCustomerId
        ? undefined
        : "Selecciona un cliente registrado.",
    }),
    [creditorName, details, selectedCustomerId],
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
    if (posted) {
      window.location.assign(`/financiamientos/${posted.loanId}`);
      return;
    }
    const target = document.querySelector<HTMLElement>("[data-print-document]");
    if (target) void printElement(target, "Plan de pagos");
  }

  async function postLoan() {
    setShowErrors(true);
    if (hasErrors || posting) {
      if (errors.customer) setPostMessage(errors.customer);
      return;
    }
    idempotencyKey.current ||= crypto.randomUUID();
    setPosting(true); setPostMessage("");
    try {
      const response = await fetch("/api/transactions/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKey.current, customerId: selectedCustomerId, accountReference: details.accountReference, price, downPayment, annualRate, termMonths: quote.months, firstDueDate: details.firstDueDate, issueDate: details.issueDate, replacesTransactionId: new URLSearchParams(window.location.search).get("reemplaza") || undefined }),
      });
      const result = await response.json() as MutationResult<PostedTransaction>;
      if (!result.ok) setPostMessage(result.message);
      else {
        setPosted(result.data);
        setPostMessage("");
        notifyDurableDirectoryChanged();
      }
    } catch { setPostMessage("No fue posible registrar el financiamiento."); }
    finally { setPosting(false); }
  }

  return (
    <section className={styles.planWorkspace} aria-labelledby="payment-plan-title">
      <header className={styles.topBar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <span aria-hidden="true">←</span>
          Cotización
        </button>
        <div>
          <p>Documento para el deudor</p>
          <h2 id="payment-plan-title">Plan de pagos</h2>
        </div>
        <span>{quote.months} cuotas</span>
      </header>

      <div className={styles.planLayout}>
        <aside className={styles.editor} aria-label="Datos del plan de pagos">
          <div className={styles.heading}>
            <div>
              <h3>Datos del préstamo</h3>
            </div>
          </div>

          <SavedCustomerPicker
            scope={storageScope}
            value={selectedCustomerId}
            onSelect={(customer) => {
              setSelectedCustomerId(customer?.id ?? "");
              if (customer) updateDetails("debtorName", customer.name);
            }}
          />

          <form className={styles.form} onSubmit={(event) => event.preventDefault()} noValidate>
            <PlanField
              id="plan-debtor-name"
              label="Deudor"
              value={details.debtorName}
              onChange={(value) => {
                setSelectedCustomerId("");
                updateDetails("debtorName", value);
              }}
              error={showErrors ? errors.debtorName : undefined}
            />
            <PlanField
              id="plan-creditor-name"
              label="Acreedor o vendedor"
              value={creditorName}
              onChange={(value) => updateDetails("creditorName", value)}
              error={showErrors ? errors.creditorName : undefined}
            />
            <PlanField
              id="plan-account-reference"
              label="Lote o cuenta"
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
              label="Primera cuota"
              type="date"
              value={details.firstDueDate}
              onChange={(value) => updateDetails("firstDueDate", value)}
              error={showErrors ? errors.firstDueDate : undefined}
              hint="Las demás fechas serán mensuales."
            />
          </form>

          <div className={styles.actions}>
            <p>{posted ? `Financiamiento ${posted.documentNumber} registrado.` : "Borrador sin registrar."}</p>
            {postMessage && <p role="status">{postMessage}</p>}
            {!posted && <button type="button" onClick={postLoan} disabled={posting}>{posting ? "Registrando…" : "Registrar financiamiento"}</button>}
            <button type="button" onClick={printPlan}>
              {posted ? "Ver documento" : "Imprimir borrador"}
            </button>
          </div>
        </aside>

        <section className={styles.preview} aria-label="Vista previa del plan de pagos">
          <div className={styles.previewLabel}>
            <span>Vista previa</span>
            <small>{rows.length > 0 ? `${rows.length} cuotas` : "Esperando fecha"}</small>
          </div>
          <div className={styles.previewViewport}>
            {rows.length > 0 ? (
              <PaymentScheduleDocument
                accountReference={details.accountReference}
                annualRate={annualRate}
                creditorName={creditorName}
                debtorName={details.debtorName}
                documentNumber={posted?.documentNumber}
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
                unposted
              />
            ) : (
              <div className={styles.emptyPreview}>
                <span aria-hidden="true">▤</span>
                <strong>El plan aparecerá aquí</strong>
                <p>Indica la fecha de la primera cuota.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
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
