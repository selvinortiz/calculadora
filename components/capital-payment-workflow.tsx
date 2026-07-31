"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  calculatePaymentSchedule,
  calculateSimpleInterestQuote,
  calculateSimpleInterestRecalculation,
  roundCurrency,
  validateLoanInputs,
} from "@/lib/finance";
import {
  PaymentRecord,
  type RecordDetails,
  type TransactionMode,
} from "./payment-record";
import { PaymentScheduleDocument } from "./payment-schedule-document";
import {
  SavedCustomerPicker,
  SavedFinancingPicker,
  type SavedFinancingSelection,
} from "./saved-profile-picker";
import { notifyDurableDirectoryChanged, useDurableDirectory } from "@/lib/use-durable-directory";
import type { DirectoryLoan, MutationResult, PostedTransaction } from "@/lib/domain";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { printElement } from "../lib/print-preview";
import styles from "./capital-payment-workflow.module.css";

type Step = 1 | 2 | 3 | 4;
type MovementErrors = Partial<
  Record<
    | "paymentNumber"
    | "capitalPayment"
    | "lastPaymentDate"
    | "transactionDate"
    | "nextPaymentDate"
    | "statementCapital",
    string
  >
>;
type BalanceSource = "calculated" | "statement";
type DocumentView = "payment-record" | "payment-schedule";

const STEPS: Array<{ number: Step; label: string }> = [
  { number: 1, label: "Préstamo" },
  { number: 2, label: "Abono" },
  { number: 3, label: "Resultado" },
  { number: 4, label: "Documentos" },
];

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INITIAL_RECORD_DETAILS: RecordDetails = {
  documentType: "record",
  debtorName: "",
  creditorName: "",
  lotReference: "",
  receiptNumber: "",
  paymentMethod: "",
  paymentReference: "",
  receivedBy: "",
  notes: "",
};

export function CapitalPaymentWorkflow({
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

  const [price, setPrice] = useState("65000");
  const [downPayment, setDownPayment] = useState("13000");
  const [annualRate, setAnnualRate] = useState("7");
  const [termMonths, setTermMonths] = useState("60");

  const [transactionMode, setTransactionMode] =
    useState<TransactionMode>("standalone");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [capitalPayment, setCapitalPayment] = useState("");
  const [lastPaymentDate, setLastPaymentDate] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState("");
  const [balanceSource, setBalanceSource] =
    useState<BalanceSource>("calculated");
  const [statementCapital, setStatementCapital] = useState("");

  const [recordDetails, setRecordDetails] = useState<RecordDetails>(() => ({
    ...INITIAL_RECORD_DETAILS,
  }));
  const [documentView, setDocumentView] =
    useState<DocumentView>("payment-record");
  const [showRecordErrors, setShowRecordErrors] = useState(false);
  const [showScheduleErrors, setShowScheduleErrors] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postMessage, setPostMessage] = useState("");
  const [posted, setPosted] = useState<PostedTransaction | null>(null);
  const creditorName =
    recordDetails.creditorName || data.organization?.name || operatorCompany;
  const receivedBy =
    recordDetails.receivedBy ||
    data.organization?.defaultRecipient ||
    operatorName;
  const resolvedRecordDetails = {
    ...recordDetails,
    creditorName,
    receivedBy,
  };

  const loanInputs = useMemo(
    () => ({
      price: parseInput(price),
      downPayment: parseInput(downPayment),
      annualRate: parseInput(annualRate),
    }),
    [annualRate, downPayment, price],
  );
  const loanErrors = useMemo(() => validateLoanInputs(loanInputs), [loanInputs]);
  const parsedTermMonths = parseInput(termMonths);
  const termError =
    !Number.isInteger(parsedTermMonths) ||
    parsedTermMonths < 2 ||
    parsedTermMonths > 360
      ? "Ingresa un plazo entre 2 y 360 meses."
      : undefined;
  const loanIsValid = Object.keys(loanErrors).length === 0 && !termError;
  const principal = loanIsValid
    ? roundCurrency(loanInputs.price - loanInputs.downPayment)
    : 0;
  const originalQuote = useMemo(
    () =>
      loanIsValid
        ? calculateSimpleInterestQuote(
            principal,
            loanInputs.annualRate,
            parsedTermMonths,
          )
        : null,
    [loanInputs.annualRate, loanIsValid, parsedTermMonths, principal],
  );

  const parsedPaymentNumber = parseInput(paymentNumber);
  const parsedCapitalPayment = parseInput(capitalPayment);
  const parsedStatementCapital = parseInput(statementCapital);
  const schedulePrincipal = selectedLoan?.currentPrincipal ?? principal;
  const scheduleMonths = selectedLoan?.remainingMonths ?? parsedTermMonths;
  const scheduleFirstPaymentNumber = selectedLoan?.nextPaymentNumber ?? 1;
  const scheduleLastPaymentNumber = scheduleFirstPaymentNumber + scheduleMonths - 1;
  const effectivePaymentNumber = parsedPaymentNumber - scheduleFirstPaymentNumber + 1;

  const movementErrors = useMemo<MovementErrors>(() => {
    const errors: MovementErrors = {};

    if (!Number.isInteger(parsedPaymentNumber)) {
      errors.paymentNumber = "Ingresa un número de cuota completo.";
    } else if (
      parsedPaymentNumber < scheduleFirstPaymentNumber ||
      parsedPaymentNumber >= scheduleLastPaymentNumber
    ) {
      errors.paymentNumber = `Debe estar entre ${scheduleFirstPaymentNumber} y ${scheduleLastPaymentNumber - 1}.`;
    }

    if (!Number.isFinite(parsedCapitalPayment) || parsedCapitalPayment <= 0) {
      errors.capitalPayment = "Ingresa un abono mayor que cero.";
    } else if (!hasCentPrecision(parsedCapitalPayment)) {
      errors.capitalPayment = "Usa como máximo dos decimales.";
    }

    if (transactionMode === "standalone" && !lastPaymentDate) {
      errors.lastPaymentDate = "Indica cuándo se pagó esa cuota.";
    }
    if (!transactionDate) {
      errors.transactionDate = "Indica la fecha del abono.";
    } else if (
      transactionMode === "standalone" &&
      lastPaymentDate &&
      transactionDate < lastPaymentDate
    ) {
      errors.transactionDate = "El abono no puede ser anterior a la última cuota.";
    }
    if (!nextPaymentDate) {
      errors.nextPaymentDate = "Indica la fecha de la próxima cuota.";
    } else if (transactionDate && nextPaymentDate <= transactionDate) {
      errors.nextPaymentDate = "Debe ser posterior a la fecha del abono.";
    }

    if (balanceSource === "statement") {
      if (
        !Number.isFinite(parsedStatementCapital) ||
        parsedStatementCapital < 0
      ) {
        errors.statementCapital = "Ingresa el capital pendiente indicado por el acreedor.";
      } else if (parsedStatementCapital > schedulePrincipal) {
        errors.statementCapital = "No puede superar el capital original.";
      } else if (!hasCentPrecision(parsedStatementCapital)) {
        errors.statementCapital = "Usa como máximo dos decimales.";
      }
    }

    if (
      loanIsValid &&
      !errors.paymentNumber &&
      !errors.capitalPayment &&
      (balanceSource !== "statement" || !errors.statementCapital)
    ) {
      const currentCapital =
        balanceSource === "statement"
          ? parsedStatementCapital
          : schedulePrincipal *
            ((scheduleMonths - effectivePaymentNumber) / scheduleMonths);

      if (parsedCapitalPayment - currentCapital > 1e-7) {
        errors.capitalPayment = "El abono no puede superar el capital pendiente.";
      }
    }

    return errors;
  }, [
    balanceSource,
    lastPaymentDate,
    loanIsValid,
    nextPaymentDate,
    parsedCapitalPayment,
    parsedPaymentNumber,
    parsedStatementCapital,
    scheduleFirstPaymentNumber,
    scheduleLastPaymentNumber,
    scheduleMonths,
    schedulePrincipal,
    effectivePaymentNumber,
    transactionDate,
    transactionMode,
  ]);
  const movementIsValid =
    loanIsValid && Object.keys(movementErrors).length === 0;

  const result = useMemo(() => {
    if (!movementIsValid) return null;

    return calculateSimpleInterestRecalculation({
      principal: schedulePrincipal,
      annualRate: loanInputs.annualRate,
      totalMonths: scheduleMonths,
      applyAfterPayment: effectivePaymentNumber,
      capitalPayment: parsedCapitalPayment,
      currentCapital:
        balanceSource === "statement" ? parsedStatementCapital : undefined,
    });
  }, [
    balanceSource,
    loanInputs.annualRate,
    movementIsValid,
    parsedCapitalPayment,
    parsedStatementCapital,
    scheduleMonths,
    schedulePrincipal,
    effectivePaymentNumber,
  ]);

  const recordErrors = useMemo(() => {
    if (recordDetails.documentType !== "record") return {};

    return {
      debtorName: recordDetails.debtorName.trim()
        ? undefined
        : "Indica el nombre del deudor.",
      creditorName: creditorName.trim()
        ? undefined
        : "Indica el nombre del acreedor.",
      lotReference: recordDetails.lotReference.trim()
        ? undefined
        : "Indica el lote o número de cuenta.",
      receiptNumber: undefined,
      paymentMethod: recordDetails.paymentMethod.trim()
        ? undefined
        : "Indica cómo se recibió el pago.",
      receivedBy: receivedBy.trim()
        ? undefined
        : "Indica quién recibió el pago.",
    };
  }, [creditorName, receivedBy, recordDetails]);
  const hasRecordErrors = Object.values(recordErrors).some(Boolean);
  const scheduleErrors = useMemo(
    () => ({
      debtorName: recordDetails.debtorName.trim()
        ? undefined
        : "Indica el nombre del deudor.",
      creditorName: creditorName.trim()
        ? undefined
        : "Indica el nombre del acreedor.",
      lotReference: recordDetails.lotReference.trim()
        ? undefined
        : "Indica el lote o número de cuenta.",
    }),
    [creditorName, recordDetails.debtorName, recordDetails.lotReference],
  );
  const hasScheduleErrors = Object.values(scheduleErrors).some(Boolean);
  const updatedScheduleRows = useMemo(
    () =>
      result && nextPaymentDate
        ? calculatePaymentSchedule({
            principal: result.newCapital,
            interestTotal: result.newFutureInterest,
            months: result.remainingMonths,
            firstDueDate: nextPaymentDate,
            firstPaymentNumber: parsedPaymentNumber + 1,
          })
        : [],
    [nextPaymentDate, parsedPaymentNumber, result],
  );

  function continueWorkflow() {
    setAttemptedStep(step);

    if (step === 1 && (!selectedLoan || !loanIsValid)) return;
    if (step === 2 && !movementIsValid) return;
    if (step === 4) return;

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

  function updateRecordDetails(field: keyof RecordDetails, value: string) {
    if (field === "debtorName") setSelectedCustomerId("");
    setRecordDetails((current) => ({ ...current, [field]: value }));
  }

  function applySavedFinancing(selection: SavedFinancingSelection | null) {
    setSelectedFinancingId(selection?.financing.id ?? "");
    setSelectedLoan(selection?.financing ?? null);
    if (!selection) return;

    const { customer, financing, organization } = selection;
    setSelectedCustomerId(customer.id);
    setPrice(String(financing.price));
    setDownPayment(String(financing.downPayment));
    setAnnualRate(String(financing.annualRate));
    setTermMonths(String(financing.termMonths));
    setPaymentNumber(String(financing.nextPaymentNumber));
    setStatementCapital(String(roundCurrency(financing.currentPrincipal * ((financing.remainingMonths - 1) / financing.remainingMonths))));
    setRecordDetails((current) => ({
      ...current,
      debtorName: customer.name,
      creditorName: organization?.name || operatorCompany,
      lotReference: financing.accountReference,
      receivedBy:
        organization?.defaultRecipient || current.receivedBy || operatorName,
    }));
  }

  async function postCapitalPayment() {
    setShowRecordErrors(true); setShowScheduleErrors(true);
    if (!selectedLoan || !result || movementErrors.capitalPayment || posting) {
      setPostMessage(!selectedLoan ? "Selecciona un financiamiento registrado." : "Revisa los datos del abono.");
      return;
    }
    idempotencyKey.current ||= crypto.randomUUID();
    setPosting(true); setPostMessage("");
    try {
      const response = await fetch("/api/transactions/capital-payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: idempotencyKey.current, loanId: selectedLoan.id, expectedLoanVersion: selectedLoan.version, transactionMode, paymentNumber: parsedPaymentNumber, capitalPayment: parsedCapitalPayment, lastPaymentDate: lastPaymentDate || null, transactionDate, nextPaymentDate, balanceSource, statementCapital: balanceSource === "statement" ? parsedStatementCapital : null, paymentMethod: recordDetails.paymentMethod, paymentReference: recordDetails.paymentReference, receivedBy, notes: recordDetails.notes, replacesTransactionId: new URLSearchParams(window.location.search).get("reemplaza") || undefined }),
      });
      const responseBody = await response.json() as MutationResult<PostedTransaction>;
      if (!responseBody.ok) setPostMessage(responseBody.message);
      else {
        setPosted(responseBody.data);
        setRecordDetails((current) => ({ ...current, receiptNumber: responseBody.data.documentNumber, documentType: "record" }));
        setPostMessage(`Abono ${responseBody.data.documentNumber} registrado.`);
        notifyDurableDirectoryChanged();
      }
    } catch { setPostMessage("No fue posible registrar el abono."); }
    finally { setPosting(false); }
  }

  function printRecord() {
    setShowRecordErrors(true);
    if (hasRecordErrors) return;
    if (posted) {
      window.location.assign(`/financiamientos/${posted.loanId}`);
      return;
    }
    const target = document.querySelector<HTMLElement>("[data-print-document]");
    if (target) void printElement(target, "Comprobante de abono a capital");
  }

  function printSchedule() {
    setShowScheduleErrors(true);
    if (hasScheduleErrors) return;
    if (posted) {
      window.location.assign(`/financiamientos/${posted.loanId}`);
      return;
    }
    const target = document.querySelector<HTMLElement>("[data-print-document]");
    if (target) void printElement(target, "Plan de pagos actualizado");
  }

  return (
    <section className={styles.workflow} aria-label="Abono a capital">
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
          <section aria-labelledby="loan-step-title">
            <StepHeading
              eyebrow="Paso 1 de 4"
              title="Financiamiento"
              description="Selecciona el financiamiento."
              id="loan-step-title"
            />
            <SavedFinancingPicker
              scope={storageScope}
              value={selectedFinancingId}
              onSelect={applySavedFinancing}
            />
            {attemptedStep === 1 && !selectedLoan && <p className={styles.validationSummary} role="status">Selecciona un financiamiento.</p>}
            {originalQuote && selectedLoan && (
              <div className={styles.inlineSummary}>
                <SummaryValue label="Capital pendiente" value={formatCurrency(selectedLoan.currentPrincipal)} />
                <SummaryValue label="Interés anual" value={`${selectedLoan.annualRate}%`} />
                <SummaryValue label="Cuotas restantes" value={String(selectedLoan.remainingMonths)} />
                <SummaryValue label="Próxima cuota" value={String(selectedLoan.nextPaymentNumber)} />
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="movement-step-title">
            <StepHeading
              eyebrow="Paso 2 de 4"
              title="Datos del abono"
              description="Ingresa el abono y las fechas."
              id="movement-step-title"
            />

            <fieldset className={styles.modeFieldset}>
              <legend>Forma de pago</legend>
              <div className={styles.modeOptions}>
                <button
                  type="button"
                  aria-pressed={transactionMode === "standalone"}
                  onClick={() => setTransactionMode("standalone")}
                >
                  <strong>Abono por separado</strong>
                  <span>La cuota anterior ya está pagada.</span>
                </button>
                <button
                  type="button"
                  aria-pressed={transactionMode === "combined"}
                  onClick={() => setTransactionMode("combined")}
                >
                  <strong>Cuota más abono</strong>
                  <span>Ambos pagos se reciben juntos.</span>
                </button>
              </div>
            </fieldset>

            <form className={styles.formGrid} onSubmit={(event) => event.preventDefault()} noValidate>
              <WorkflowField
                id="workflow-payment-number"
                label={
                  transactionMode === "standalone"
                    ? "Última cuota pagada"
                    : "Cuota que se recibe"
                }
                value={paymentNumber}
                onChange={(event) => setPaymentNumber(event.target.value)}
                hint={`${parsedTermMonths} cuotas en total`}
                error={attemptedStep === 2 ? movementErrors.paymentNumber : undefined}
                max={Math.max(1, parsedTermMonths - 1)}
                step="1"
              />
              <WorkflowField
                id="workflow-capital-payment"
                label="Abono a capital"
                value={capitalPayment}
                onChange={(event) => setCapitalPayment(event.target.value)}
                error={attemptedStep === 2 ? movementErrors.capitalPayment : undefined}
                max={schedulePrincipal}
              />
              {transactionMode === "standalone" && (
                <DateField
                  id="last-payment-date"
                  label="Fecha de la última cuota"
                  value={lastPaymentDate}
                  onChange={(event) => setLastPaymentDate(event.target.value)}
                  error={attemptedStep === 2 ? movementErrors.lastPaymentDate : undefined}
                />
              )}
              <DateField
                id="transaction-date"
                label={transactionMode === "standalone" ? "Fecha de recepción del abono" : "Fecha de la transacción"}
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
                error={attemptedStep === 2 ? movementErrors.transactionDate : undefined}
              />
              <DateField
                id="next-payment-date"
                label="Fecha de la próxima cuota"
                value={nextPaymentDate}
                onChange={(event) => setNextPaymentDate(event.target.value)}
                error={attemptedStep === 2 ? movementErrors.nextPaymentDate : undefined}
              />
            </form>

            <fieldset className={styles.balanceFieldset}>
              <legend>Saldo de capital</legend>
              <div className={styles.balanceControls}>
                <div className={styles.segmentedControl}>
                  <button
                    type="button"
                    aria-pressed={balanceSource === "calculated"}
                    onClick={() => setBalanceSource("calculated")}
                  >
                    Saldo calculado
                  </button>
                  <button
                    type="button"
                    aria-pressed={balanceSource === "statement"}
                    onClick={() => setBalanceSource("statement")}
                  >
                    Estado de cuenta
                  </button>
                </div>
                {balanceSource === "statement" && (
                  <WorkflowField
                    id="statement-capital"
                    label={`Capital después de la cuota ${paymentNumber || "—"}`}
                    value={statementCapital}
                    onChange={(event) => setStatementCapital(event.target.value)}
                    hint="Sin intereses ni cargos"
                    error={attemptedStep === 2 ? movementErrors.statementCapital : undefined}
                    max={schedulePrincipal}
                  />
                )}
              </div>
            </fieldset>

            {attemptedStep === 2 && !movementIsValid && (
              <p className={styles.validationSummary} role="status">
                Revisa los campos señalados antes de calcular el nuevo plan.
              </p>
            )}
          </section>
        )}

        {step === 3 && result && (
          <section aria-labelledby="result-step-title">
            <StepHeading
              eyebrow="Paso 3 de 4"
              title="Nuevo plan"
              description="Revisa el nuevo saldo y las cuotas."
              id="result-step-title"
            />

            <div className={styles.movementSummary}>
              <SummaryValue
                label="Movimiento"
                value={transactionMode === "standalone" ? "Abono a capital" : `Cuota ${parsedPaymentNumber} + abono`}
              />
              <SummaryValue
                label="Total recibido"
                value={formatCurrency(transactionMode === "standalone" ? parsedCapitalPayment : result.paymentThisMonth)}
              />
              <SummaryValue label="Fecha" value={formatDate(transactionDate)} />
              <SummaryValue label="Próxima cuota" value={`${parsedPaymentNumber + 1} · ${formatDate(nextPaymentDate)}`} />
            </div>

            <div className={styles.resultGrid}>
              <ResultValue label="Nuevo saldo de capital" value={formatCurrency(result.newCapital)} emphasized />
              <ResultValue label="Nueva cuota mensual" value={formatCurrency(result.newMonthlyPayment)} note={`${result.remainingMonths} cuotas restantes`} emphasized />
              <ResultValue label="Total futuro" value={formatCurrency(result.newScheduledBalance)} note="Capital más interés" />
              <ResultValue label="Interés reducido" value={formatCurrency(result.totalInterestReduction)} />
            </div>
            <p className={styles.installmentNote}>
              {formatInstallments(result.remainingMonths, result.newMonthlyPayment, result.newFinalPayment)}
            </p>

            <div className={styles.comparisonRegion} role="region" aria-label="Antes y después del abono" tabIndex={0}>
              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th scope="col">Concepto</th>
                    <th scope="col">Antes</th>
                    <th scope="col">Después</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow label="Saldo de capital" before={formatCurrency(result.currentCapital)} after={formatCurrency(result.newCapital)} />
                  <ComparisonRow label="Interés futuro" before={formatCurrency(result.originalFutureInterest)} after={formatCurrency(result.newFutureInterest)} />
                  <ComparisonRow label="Saldo programado" before={formatCurrency(result.originalScheduledBalance)} after={formatCurrency(result.newScheduledBalance)} />
                  <ComparisonRow label="Cuota mensual" before={formatCurrency(result.regularPayment)} after={formatCurrency(result.newMonthlyPayment)} />
                </tbody>
              </table>
            </div>

          </section>
        )}

        {step === 4 && result && (
          <section aria-labelledby="record-step-title">
            <StepHeading
              eyebrow="Paso 4 de 4"
              title="Documentos"
              description="Elige qué deseas imprimir."
              id="record-step-title"
            />

            <fieldset className={styles.documentChoiceFieldset}>
              <legend>Documento</legend>
              <div className={styles.documentOptions}>
                <button
                  type="button"
                  aria-pressed={documentView === "payment-record"}
                  onClick={() => setDocumentView("payment-record")}
                >
                  <strong>Comprobante</strong>
                </button>
                <button
                  type="button"
                  aria-pressed={documentView === "payment-schedule"}
                  onClick={() => setDocumentView("payment-schedule")}
                >
                  <strong>Plan actualizado</strong>
                </button>
              </div>
            </fieldset>

            {documentView === "payment-record" ? (
              <div className={styles.documentWorkspace}>
                <div className={styles.documentEditor}>
                  <SavedCustomerPicker
                    scope={storageScope}
                    value={selectedCustomerId}
                    onSelect={(customer) => {
                      setSelectedCustomerId(customer?.id ?? "");
                      if (customer) {
                        setRecordDetails((current) => ({
                          ...current,
                          debtorName: customer.name,
                        }));
                      }
                    }}
                  />
                  <fieldset className={styles.documentTypeFieldset}>
                    <legend>Tipo de comprobante</legend>
                    <div className={styles.segmentedControl}>
                      <button
                        type="button"
                        aria-pressed={recordDetails.documentType === "record"}
                        onClick={() => updateRecordDetails("documentType", "record")}
                      >
                        Recibo
                      </button>
                      <button
                        type="button"
                        aria-pressed={recordDetails.documentType === "simulation"}
                        onClick={() => updateRecordDetails("documentType", "simulation")}
                      >
                        Simulación
                      </button>
                    </div>
                  </fieldset>

                  <form className={styles.recordForm} onSubmit={(event) => event.preventDefault()} noValidate>
                    <TextField required={recordDetails.documentType === "record"} label="Deudor" id="debtor-name" value={recordDetails.debtorName} onChange={(value) => updateRecordDetails("debtorName", value)} error={showRecordErrors ? recordErrors.debtorName : undefined} />
                    <TextField required={recordDetails.documentType === "record"} label="Acreedor o vendedor" id="creditor-name" value={creditorName} onChange={(value) => updateRecordDetails("creditorName", value)} error={showRecordErrors ? recordErrors.creditorName : undefined} />
                    <TextField required={recordDetails.documentType === "record"} label="Lote o cuenta" id="lot-reference" value={recordDetails.lotReference} onChange={(value) => updateRecordDetails("lotReference", value)} error={showRecordErrors ? recordErrors.lotReference : undefined} />
                    <TextField required={false} label="Número de recibo" id="receipt-number" value={recordDetails.receiptNumber || "Se asigna al registrar"} onChange={() => undefined} />
                    <SelectField required={recordDetails.documentType === "record"} label="Medio de pago" id="payment-method" value={recordDetails.paymentMethod} options={PAYMENT_METHODS} onChange={(value) => updateRecordDetails("paymentMethod", value)} error={showRecordErrors ? recordErrors.paymentMethod : undefined} />
                    <TextField label="Referencia" id="payment-reference" value={recordDetails.paymentReference} onChange={(value) => updateRecordDetails("paymentReference", value)} />
                    <TextField required={recordDetails.documentType === "record"} label="Recibido por" id="received-by" value={receivedBy} onChange={(value) => updateRecordDetails("receivedBy", value)} error={showRecordErrors ? recordErrors.receivedBy : undefined} />
                    <TextField label="Observaciones" id="record-notes" value={recordDetails.notes} onChange={(value) => updateRecordDetails("notes", value)} />
                  </form>

                  <div className={styles.recordActions}>
                    <button type="button" className={styles.printButton} onClick={printRecord}>
                      {posted ? "Ver documento" : "Imprimir borrador"}
                    </button>
                  </div>
                </div>

                <DocumentPreview label="Vista previa del comprobante">
                  <PaymentRecord
                    annualRate={loanInputs.annualRate}
                    balanceSource={balanceSource}
                    capitalPayment={parsedCapitalPayment}
                    details={resolvedRecordDetails}
                    downPayment={loanInputs.downPayment}
                    lastPaymentDate={lastPaymentDate}
                    nextPaymentDate={nextPaymentDate}
                    paymentNumber={parsedPaymentNumber}
                    price={loanInputs.price}
                    result={result}
                    termMonths={parsedTermMonths}
                    transactionDate={transactionDate}
                    transactionMode={transactionMode}
                    unposted
                  />
                </DocumentPreview>
              </div>
            ) : (
              <div className={styles.documentWorkspace}>
                <div className={styles.documentEditor}>
                  <SavedCustomerPicker
                    scope={storageScope}
                    value={selectedCustomerId}
                    onSelect={(customer) => {
                      setSelectedCustomerId(customer?.id ?? "");
                      if (customer) {
                        setRecordDetails((current) => ({
                          ...current,
                          debtorName: customer.name,
                        }));
                      }
                    }}
                  />
                  <form className={styles.recordForm} onSubmit={(event) => event.preventDefault()} noValidate>
                    <TextField required label="Deudor" id="schedule-debtor-name" value={recordDetails.debtorName} onChange={(value) => updateRecordDetails("debtorName", value)} error={showScheduleErrors ? scheduleErrors.debtorName : undefined} />
                    <TextField required label="Acreedor o vendedor" id="schedule-creditor-name" value={creditorName} onChange={(value) => updateRecordDetails("creditorName", value)} error={showScheduleErrors ? scheduleErrors.creditorName : undefined} />
                    <TextField required label="Lote o cuenta" id="schedule-lot-reference" value={recordDetails.lotReference} onChange={(value) => updateRecordDetails("lotReference", value)} error={showScheduleErrors ? scheduleErrors.lotReference : undefined} />
                  </form>

                  <div className={styles.recordActions}>
                    <p>Comienza con la cuota {parsedPaymentNumber + 1}.</p>
                    <button type="button" className={styles.printButton} onClick={printSchedule}>
                      {posted ? "Ver documento" : "Imprimir borrador"}
                    </button>
                  </div>
                </div>

                <DocumentPreview label="Vista previa del plan actualizado">
                  <PaymentScheduleDocument
                    accountReference={recordDetails.lotReference}
                    annualRate={loanInputs.annualRate}
                    capitalPayment={parsedCapitalPayment}
                    creditorName={creditorName}
                    debtorName={recordDetails.debtorName}
                    downPayment={loanInputs.downPayment}
                    finalPayment={result.newFinalPayment}
                    interestTotal={result.newFutureInterest}
                    issueDate={transactionDate}
                    monthlyPayment={result.newMonthlyPayment}
                    originalTermMonths={parsedTermMonths}
                    previousPaymentNumber={parsedPaymentNumber}
                    previousPrincipal={result.currentCapital}
                    price={loanInputs.price}
                    principal={result.newCapital}
                    rows={updatedScheduleRows}
                    scheduledTotal={result.newScheduledBalance}
                    variant="updated"
                    unposted
                  />
                </DocumentPreview>
              </div>
            )}
          </section>
        )}

        <div className={styles.workflowActions}>
          {step > 1 && (
            <button type="button" className={styles.backButton} onClick={goBack}>
              Atrás
            </button>
          )}
          {step < 4 && (
            <button type="button" className={styles.continueButton} onClick={continueWorkflow} disabled={step === 1 && !selectedLoan}>
              {step === 3 ? "Preparar documentos" : "Continuar"}
            </button>
          )}
          {step === 4 && !posted && (
            <button type="button" className={styles.continueButton} onClick={postCapitalPayment} disabled={posting}>{posting ? "Registrando…" : "Registrar abono a capital"}</button>
          )}
          {step === 4 && posted && <a href={`/financiamientos/${posted.loanId}`}>Ver financiamiento {posted.documentNumber}</a>}
          {step === 4 && postMessage && <p role="status">{postMessage}</p>}
        </div>
      </div>
    </section>
  );
}

function DocumentPreview({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className={styles.documentPreview} aria-label={label}>
      <div className={styles.previewLabel}>{label}</div>
      <div className={styles.previewViewport}>{children}</div>
    </section>
  );
}

function StepHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description: string; id: string }) {
  return (
    <header className={styles.stepHeading}>
      <p>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <span>{description}</span>
    </header>
  );
}

function WorkflowField({ error, hint, id, label, max, onChange, step = "0.01", value }: { error?: string; hint?: string; id: string; label: string; max: number; onChange: (event: ChangeEvent<HTMLInputElement>) => void; step?: string; value: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min={0} max={max} step={step} value={value} onChange={onChange} aria-invalid={error ? true : undefined} aria-describedby={error ? `${hint ? `${id}-hint ` : ""}${id}-error` : hint ? `${id}-hint` : undefined} />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function DateField({ error, id, label, onChange, value }: { error?: string; id: string; label: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; value: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="date" value={value} onChange={onChange} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function TextField({ error, id, label, onChange, placeholder, required = false, value }: { error?: string; id: string; label: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; value: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <input id={id} type="text" value={value} placeholder={placeholder} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function SelectField({ error, id, label, onChange, options, required = false, value }: { error?: string; id: string; label: string; onChange: (value: string) => void; options: readonly string[]; required?: boolean; value: string }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <select id={id} value={value} required={required} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
        <option value="">Seleccionar</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function ResultValue({ emphasized = false, label, note, value }: { emphasized?: boolean; label: string; note?: string; value: string }) {
  return <div className={`${styles.resultValue} ${emphasized ? styles.emphasized : ""}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function ComparisonRow({ after, before, label }: { after: string; before: string; label: string }) {
  return <tr><th scope="row">{label}</th><td>{before}</td><td>{after}</td></tr>;
}

function parseInput(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function hasCentPrecision(value: number): boolean {
  return Math.abs(roundCurrency(value) - value) < 1e-7;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: string): string {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-GT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function formatInstallments(months: number, monthly: number, finalPayment: number): string {
  if (months === 1) return `Una cuota final de ${formatCurrency(finalPayment)}.`;
  return `${months - 1} cuotas de ${formatCurrency(monthly)} y una última cuota de ${formatCurrency(finalPayment)}.`;
}
