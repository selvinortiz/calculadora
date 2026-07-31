"use client";

import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  calculatePaymentCreditAdjustment,
  type PaymentCreditAdjustment,
} from "@/lib/finance";
import { notifyDurableDirectoryChanged, useDurableDirectory } from "@/lib/use-durable-directory";
import type { DirectoryLoan, MutationResult, PostedTransaction } from "@/lib/domain";
import {
  SavedCustomerPicker,
  SavedFinancingPicker,
  type SavedFinancingSelection,
} from "./saved-profile-picker";
import {
  PaymentAdjustmentRecord,
  type PaymentAdjustmentRecordDetails,
} from "./payment-adjustment-record";
import styles from "./payment-adjustment-workflow.module.css";
import { printElement } from "../lib/print-preview";

type Step = 1 | 2 | 3;
type PaymentErrors = Partial<
  Record<
    | "paymentNumber"
    | "paymentDate"
    | "scheduledPayment"
    | "receivedPayment"
    | "nextPaymentDate",
    string
  >
>;

const STEPS: Array<{ number: Step; label: string }> = [
  { number: 1, label: "Pago" },
  { number: 2, label: "Ajuste" },
  { number: 3, label: "Constancia" },
];

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INITIAL_DETAILS: PaymentAdjustmentRecordDetails = {
  debtorName: "",
  creditorName: "",
  accountReference: "",
  documentNumber: "",
  adjustedBy: "",
  paymentReference: "",
  notes: "",
};

export function PaymentAdjustmentWorkflow({
  operatorCompany,
  operatorName,
  storageScope,
}: {
  operatorCompany: string;
  operatorName: string;
  storageScope: string;
}) {
  const { data } = useDurableDirectory();
  const idempotencyKey = useRef<string | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState<Step>(1);
  const [attemptedStep, setAttemptedStep] = useState<Step | null>(null);
  const [selectedFinancingId, setSelectedFinancingId] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<DirectoryLoan | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayIso);
  const [scheduledPayment, setScheduledPayment] = useState("");
  const [receivedPayment, setReceivedPayment] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState(getNextMonthIso);

  const [details, setDetails] = useState<PaymentAdjustmentRecordDetails>(() => ({
    ...INITIAL_DETAILS,
  }));
  const [issueDate, setIssueDate] = useState(getTodayIso);
  const [showDocumentErrors, setShowDocumentErrors] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postMessage, setPostMessage] = useState("");
  const [posted, setPosted] = useState<PostedTransaction | null>(null);

  const resolvedCreditorName =
    details.creditorName || data.organization?.name || operatorCompany;
  const resolvedAdjustedBy =
    details.adjustedBy || data.organization?.defaultRecipient || operatorName;
  const resolvedDetails = {
    ...details,
    creditorName: resolvedCreditorName,
    adjustedBy: resolvedAdjustedBy,
  };

  const parsedPaymentNumber = parseInput(paymentNumber);
  const parsedScheduledPayment = parseInput(scheduledPayment);
  const parsedReceivedPayment = parseInput(receivedPayment);

  const paymentErrors = useMemo<PaymentErrors>(() => {
    const errors: PaymentErrors = {};

    if (!Number.isInteger(parsedPaymentNumber) || parsedPaymentNumber <= 0) {
      errors.paymentNumber = "Ingresa un número de cuota válido.";
    }
    if (
      !Number.isFinite(parsedScheduledPayment) ||
      parsedScheduledPayment <= 0
    ) {
      errors.scheduledPayment = "Ingresa la cuota programada.";
    } else if (!hasCentPrecision(parsedScheduledPayment)) {
      errors.scheduledPayment = "Usa como máximo dos decimales.";
    }
    if (
      !Number.isFinite(parsedReceivedPayment) ||
      parsedReceivedPayment <= 0
    ) {
      errors.receivedPayment = "Ingresa el pago recibido.";
    } else if (!hasCentPrecision(parsedReceivedPayment)) {
      errors.receivedPayment = "Usa como máximo dos decimales.";
    } else if (
      !errors.scheduledPayment &&
      parsedReceivedPayment <= parsedScheduledPayment
    ) {
      errors.receivedPayment = "Debe ser mayor que la cuota programada.";
    } else if (
      !errors.scheduledPayment &&
      parsedReceivedPayment - parsedScheduledPayment >= parsedScheduledPayment
    ) {
      errors.receivedPayment =
        "Este ajuste admite un saldo menor que una cuota completa.";
    }
    if (!paymentDate) {
      errors.paymentDate = "Indica la fecha del pago recibido.";
    }
    if (!nextPaymentDate) {
      errors.nextPaymentDate = "Indica la fecha de la próxima cuota.";
    } else if (paymentDate && nextPaymentDate <= paymentDate) {
      errors.nextPaymentDate = "Debe ser posterior a la fecha del pago.";
    }

    return errors;
  }, [
    nextPaymentDate,
    parsedPaymentNumber,
    parsedReceivedPayment,
    parsedScheduledPayment,
    paymentDate,
  ]);
  const paymentIsValid = Object.keys(paymentErrors).length === 0;

  const adjustment = useMemo<PaymentCreditAdjustment | null>(() => {
    if (!paymentIsValid) return null;
    return calculatePaymentCreditAdjustment({
      paymentNumber: parsedPaymentNumber,
      scheduledPayment: parsedScheduledPayment,
      receivedPayment: parsedReceivedPayment,
    });
  }, [
    parsedPaymentNumber,
    parsedReceivedPayment,
    parsedScheduledPayment,
    paymentIsValid,
  ]);

  const documentErrors = useMemo(
    () => ({
      debtorName: details.debtorName.trim()
        ? undefined
        : "Indica el nombre del deudor.",
      creditorName: resolvedCreditorName.trim()
        ? undefined
        : "Indica el nombre del acreedor.",
      accountReference: details.accountReference.trim()
        ? undefined
        : "Indica el lote o número de cuenta.",
      documentNumber: undefined,
      adjustedBy: resolvedAdjustedBy.trim()
        ? undefined
        : "Indica quién autoriza el ajuste.",
      issueDate: issueDate ? undefined : "Indica la fecha de emisión.",
    }),
    [details, issueDate, resolvedAdjustedBy, resolvedCreditorName],
  );
  const hasDocumentErrors = Object.values(documentErrors).some(Boolean);

  function continueWorkflow() {
    setAttemptedStep(step);
    if (step === 1 && (!selectedLoan || !paymentIsValid)) return;
    if (step === 3) return;

    const nextStep = (step + 1) as Step;
    setStep(nextStep);
    setMaxStep((current) => (nextStep > current ? nextStep : current));
    setAttemptedStep(null);
  }

  function goBack() {
    if (step === 1) return;
    setStep((step - 1) as Step);
    setAttemptedStep(null);
  }

  function openStep(nextStep: Step) {
    if (nextStep > maxStep) return;
    setStep(nextStep);
    setAttemptedStep(null);
  }

  function applySavedFinancing(selection: SavedFinancingSelection | null) {
    setSelectedFinancingId(selection?.financing.id ?? "");
    setSelectedLoan(selection?.financing ?? null);
    if (!selection) return;

    const { customer, financing, organization } = selection;
    setSelectedCustomerId(customer.id);
    setPaymentNumber(String(financing.nextPaymentNumber));
    setScheduledPayment(String(financing.currentPayment));
    setDetails((current) => ({
      ...current,
      debtorName: customer.name,
      creditorName: organization?.name || operatorCompany,
      accountReference: financing.accountReference,
      adjustedBy:
        organization?.defaultRecipient || current.adjustedBy || operatorName,
    }));
  }

  async function postAdjustment() {
    setShowDocumentErrors(true);
    if (!selectedLoan || !adjustment || posting) {
      setPostMessage(!selectedLoan ? "Selecciona un financiamiento registrado." : "Revisa los datos del ajuste.");
      return;
    }
    idempotencyKey.current ||= crypto.randomUUID();
    setPosting(true); setPostMessage("");
    try {
      const response = await fetch("/api/transactions/payment-adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idempotencyKey: idempotencyKey.current, loanId: selectedLoan.id, expectedLoanVersion: selectedLoan.version, paymentNumber: parsedPaymentNumber, paymentDate, nextPaymentDate, receivedPayment: parsedReceivedPayment, paymentReference: details.paymentReference, adjustedBy: resolvedAdjustedBy, notes: details.notes, replacesTransactionId: new URLSearchParams(window.location.search).get("reemplaza") || undefined }) });
      const responseBody = await response.json() as MutationResult<PostedTransaction>;
      if (!responseBody.ok) setPostMessage(responseBody.message);
      else {
        setPosted(responseBody.data);
        setDetails((current) => ({ ...current, documentNumber: responseBody.data.documentNumber }));
        setPostMessage(`Ajuste ${responseBody.data.documentNumber} registrado.`);
        notifyDurableDirectoryChanged();
      }
    } catch { setPostMessage("No fue posible registrar el ajuste."); }
    finally { setPosting(false); }
  }

  function updateDetails(
    field: keyof PaymentAdjustmentRecordDetails,
    value: string,
  ) {
    if (field === "debtorName") setSelectedCustomerId("");
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function printDocument() {
    setShowDocumentErrors(true);
    if (hasDocumentErrors) return;
    if (posted) {
      window.location.assign(`/financiamientos/${posted.loanId}`);
      return;
    }
    const target = document.querySelector<HTMLElement>("[data-print-document]");
    if (target) void printElement(target, "Constancia de ajuste de pago");
  }

  return (
    <section className={styles.workflow} aria-label="Ajuste de pago">
      <ol className={styles.stepper} data-print-hidden>
        {STEPS.map((item) => (
          <li key={item.number}>
            <button
              type="button"
              className={styles.stepButton}
              aria-current={step === item.number ? "step" : undefined}
              disabled={item.number > maxStep}
              onClick={() => openStep(item.number)}
            >
              <span>{item.number}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.panel}>
        {step === 1 && (
          <section aria-labelledby="payment-step-title">
            <StepHeading
              eyebrow="Paso 1 de 3"
              title="Pago recibido"
              description="Compara la cuota con el pago recibido."
              id="payment-step-title"
            />

            <SavedFinancingPicker
              scope={storageScope}
              value={selectedFinancingId}
              onSelect={applySavedFinancing}
            />
            {attemptedStep === 1 && !selectedLoan && <p role="status">Selecciona un financiamiento.</p>}

            <form className={styles.formGrid} onSubmit={(event) => event.preventDefault()} noValidate>
              <Field
                id="adjustment-payment-number"
                label="Cuota revisada"
                value={paymentNumber}
                onChange={(event) => setPaymentNumber(event.target.value)}
                error={attemptedStep === 1 ? paymentErrors.paymentNumber : undefined}
                min={1}
                step="1"
              />
              <DateField
                id="adjustment-payment-date"
                label="Fecha del pago"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                error={attemptedStep === 1 ? paymentErrors.paymentDate : undefined}
              />
              <Field
                id="adjustment-scheduled-payment"
                label="Cuota programada"
                value={scheduledPayment}
                onChange={(event) => setScheduledPayment(event.target.value)}
                error={attemptedStep === 1 ? paymentErrors.scheduledPayment : undefined}
              />
              <Field
                id="adjustment-received-payment"
                label="Pago recibido"
                value={receivedPayment}
                onChange={(event) => setReceivedPayment(event.target.value)}
                error={attemptedStep === 1 ? paymentErrors.receivedPayment : undefined}
              />
              <DateField
                id="adjustment-next-payment-date"
                label="Fecha de la próxima cuota"
                value={nextPaymentDate}
                onChange={(event) => setNextPaymentDate(event.target.value)}
                error={attemptedStep === 1 ? paymentErrors.nextPaymentDate : undefined}
              />
            </form>

            {adjustment && (
              <div className={styles.inlineSummary} aria-live="polite">
                <SummaryValue label="Cuota programada" value={formatCurrency(adjustment.scheduledPayment)} />
                <SummaryValue label="Pago recibido" value={formatCurrency(adjustment.receivedPayment)} />
                <SummaryValue label="Saldo a favor" value={formatCurrency(adjustment.creditBalance)} emphasized />
                <SummaryValue label={`Cuota ${adjustment.nextPaymentNumber} por recibir`} value={formatCurrency(adjustment.adjustedNextPayment)} emphasized />
              </div>
            )}
          </section>
        )}

        {step === 2 && adjustment && (
          <section aria-labelledby="result-step-title">
            <StepHeading
              eyebrow="Paso 2 de 3"
              title="Aplicación del saldo a favor"
              description={`El saldo se aplicará a la cuota ${adjustment.nextPaymentNumber}.`}
              id="result-step-title"
            />

            <div className={styles.resultHero}>
              <div>
                <span>Saldo a favor</span>
                <strong>{formatCurrency(adjustment.creditBalance)}</strong>
                <small>Anticipo de la próxima cuota</small>
              </div>
              <span aria-hidden="true">→</span>
              <div data-emphasized="true">
                <span>Cuota {adjustment.nextPaymentNumber} por recibir</span>
                <strong>{formatCurrency(adjustment.adjustedNextPayment)}</strong>
                <small>Vence el {formatDate(nextPaymentDate)}</small>
              </div>
            </div>

            <div className={styles.impactTableRegion} role="region" aria-label="Cuotas afectadas por el ajuste" tabIndex={0}>
              <table className={styles.impactTable}>
                <thead>
                  <tr>
                    <th scope="col">Cuota</th>
                    <th scope="col">Programado</th>
                    <th scope="col">Saldo aplicado</th>
                    <th scope="col">Por recibir</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">{adjustment.nextPaymentNumber}</th>
                    <td>{formatCurrency(adjustment.scheduledPayment)}</td>
                    <td>−{formatCurrency(adjustment.creditBalance)}</td>
                    <td><strong>{formatCurrency(adjustment.adjustedNextPayment)}</strong></td>
                  </tr>
                  <tr>
                    <th scope="row">Desde la {adjustment.followingPaymentNumber}</th>
                    <td>{formatCurrency(adjustment.regularPaymentAfterAdjustment)}</td>
                    <td>—</td>
                    <td>{formatCurrency(adjustment.regularPaymentAfterAdjustment)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <aside className={styles.unchangedNote}>
              <span aria-hidden="true">✓</span>
              <div>
                <strong>El capital, el interés y el plazo no cambian.</strong>
              </div>
            </aside>
          </section>
        )}

        {step === 3 && adjustment && (
          <section aria-labelledby="document-step-title">
            <StepHeading
              eyebrow="Paso 3 de 3"
              title="Constancia del ajuste"
              description="Completa y revisa la constancia."
              id="document-step-title"
            />

            <div className={styles.documentWorkspace}>
              <aside className={styles.documentEditor} aria-label="Datos de la constancia">
                <SavedCustomerPicker
                  scope={storageScope}
                  value={selectedCustomerId}
                  onSelect={(customer) => {
                    setSelectedCustomerId(customer?.id ?? "");
                    if (customer) {
                      setDetails((current) => ({
                        ...current,
                        debtorName: customer.name,
                      }));
                    }
                  }}
                />

                <form className={styles.documentForm} onSubmit={(event) => event.preventDefault()} noValidate>
                  <TextField
                    id="adjustment-debtor-name"
                    label="Deudor"
                    value={details.debtorName}
                    onChange={(value) => updateDetails("debtorName", value)}
                    error={showDocumentErrors ? documentErrors.debtorName : undefined}
                  />
                  <TextField
                    id="adjustment-creditor-name"
                    label="Acreedor"
                    value={resolvedCreditorName}
                    onChange={(value) => updateDetails("creditorName", value)}
                    error={showDocumentErrors ? documentErrors.creditorName : undefined}
                  />
                  <TextField
                    id="adjustment-account-reference"
                    label="Lote o cuenta"
                    value={details.accountReference}
                    onChange={(value) => updateDetails("accountReference", value)}
                    error={showDocumentErrors ? documentErrors.accountReference : undefined}
                  />
                  <TextField
                    id="adjustment-document-number"
                    label="Número de constancia"
                    value={details.documentNumber || "Se asigna al registrar"}
                    onChange={() => undefined}
                    error={showDocumentErrors ? documentErrors.documentNumber : undefined}
                  />
                  <TextField
                    id="adjustment-issue-date"
                    label="Fecha de emisión"
                    type="date"
                    value={issueDate}
                    onChange={setIssueDate}
                    error={showDocumentErrors ? documentErrors.issueDate : undefined}
                  />
                  <TextField
                    id="adjustment-adjusted-by"
                    label="Ajustado por"
                    value={resolvedAdjustedBy}
                    onChange={(value) => updateDetails("adjustedBy", value)}
                    error={showDocumentErrors ? documentErrors.adjustedBy : undefined}
                  />
                  <TextField
                    id="adjustment-payment-reference"
                    label="Referencia del pago"
                    required={false}
                    value={details.paymentReference}
                    onChange={(value) => updateDetails("paymentReference", value)}
                  />
                  <TextAreaField
                    id="adjustment-notes"
                    label="Observaciones"
                    value={details.notes}
                    onChange={(value) => updateDetails("notes", value)}
                  />
                </form>

                <div className={styles.documentActions}>
                  <button type="button" className={styles.printButton} onClick={printDocument}>
                    {posted ? "Ver documento" : "Imprimir borrador"}
                  </button>
                </div>
              </aside>

              <section className={styles.documentPreview} aria-label="Vista previa de la constancia">
                <p className={styles.previewLabel}>Vista previa</p>
                <div className={styles.previewViewport}>
                  <PaymentAdjustmentRecord
                    adjustment={adjustment}
                    details={resolvedDetails}
                    issueDate={issueDate}
                    nextPaymentDate={nextPaymentDate}
                    paymentDate={paymentDate}
                    unposted
                  />
                </div>
              </section>
            </div>
          </section>
        )}

        <div className={styles.workflowActions} data-print-hidden>
          {step > 1 ? (
            <button type="button" className={styles.backButton} onClick={goBack}>
              Atrás
            </button>
          ) : (
            <span />
          )}
          {step < 3 && (
            <button type="button" className={styles.continueButton} onClick={continueWorkflow} disabled={step === 1 && !selectedLoan}>
              {step === 1 ? "Revisar ajuste" : "Preparar constancia"}
            </button>
          )}
          {step === 3 && !posted && <button type="button" className={styles.continueButton} onClick={postAdjustment} disabled={posting}>{posting ? "Registrando…" : "Registrar ajuste"}</button>}
          {step === 3 && posted && <a href={`/financiamientos/${posted.loanId}`}>Ver financiamiento {posted.documentNumber}</a>}
          {step === 3 && postMessage && <p role="status">{postMessage}</p>}
        </div>
      </div>
    </section>
  );
}

function StepHeading({
  description,
  eyebrow,
  id,
  title,
}: {
  description: string;
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <header className={styles.stepHeading}>
      <p>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <span>{description}</span>
    </header>
  );
}

function Field({
  error,
  hint,
  id,
  label,
  max,
  min = 0,
  onChange,
  step = "0.01",
  value,
}: {
  error?: string;
  hint?: string;
  id: string;
  label: string;
  max?: number;
  min?: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  value: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function DateField({
  error,
  id,
  label,
  onChange,
  value,
}: {
  error?: string;
  id: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  value: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function TextField({
  error,
  id,
  label,
  onChange,
  required = true,
  type = "text",
  value,
}: {
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "date" | "text";
  value: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SummaryValue({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: ReactNode;
}) {
  return (
    <div data-emphasized={emphasized ? "true" : undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function parseInput(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function hasCentPrecision(value: number): boolean {
  return Math.abs(Math.round(value * 100) / 100 - value) < 1e-7;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: string): string {
  if (!value) return "sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function getTodayIso(): string {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function getNextMonthIso(): string {
  const today = getTodayIso();
  const [year, month, day] = today.split("-").map(Number);
  const targetMonth = month === 12 ? 1 : month + 1;
  const targetYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();

  return [
    String(targetYear).padStart(4, "0"),
    String(targetMonth).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
}
