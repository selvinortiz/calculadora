"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import {
  calculateSimpleInterestQuote,
  calculateTermRows,
  LOAN_LIMITS,
  roundCurrency,
  validateLoanInputs,
} from "@/lib/finance";
import { LoanPaymentPlan } from "./loan-payment-plan";
import styles from "./loan-calculator.module.css";

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type PlanDefaults = {
  accountReference: string;
  creditorName: string;
  customerId: string;
  debtorName: string;
  firstDueDate: string;
};

export function LoanCalculator({
  operatorCompany,
  storageScope,
}: {
  operatorCompany: string;
  storageScope: string;
}) {
  const [view, setView] = useState<"quote" | "plan">("quote");
  const [planDefaults] = useState<PlanDefaults>({
    accountReference: "",
    creditorName: "",
    customerId: "",
    debtorName: "",
    firstDueDate: "",
  });
  const [price, setPrice] = useState("65000");
  const [downPayment, setDownPayment] = useState("13000");
  const [annualRate, setAnnualRate] = useState("7");
  const [termYears, setTermYears] = useState("5");

  const inputs = useMemo(
    () => ({
      price: parseInput(price),
      downPayment: parseInput(downPayment),
      annualRate: parseInput(annualRate),
    }),
    [annualRate, downPayment, price],
  );
  const errors = useMemo(() => validateLoanInputs(inputs), [inputs]);
  const parsedTermYears = parseInput(termYears);
  const parsedTermMonths = parsedTermYears * 12;
  const termError =
    !Number.isInteger(parsedTermMonths) ||
    parsedTermMonths < 12 ||
    parsedTermMonths > 360
      ? "Ingresa un plazo entre 1 y 30 años, en meses completos."
      : undefined;
  const isValid = Object.keys(errors).length === 0 && !termError;
  const principal = isValid
    ? roundCurrency(inputs.price - inputs.downPayment)
    : 0;
  const quote = useMemo(
    () =>
      isValid
        ? calculateSimpleInterestQuote(
            principal,
            inputs.annualRate,
            parsedTermMonths,
          )
        : null,
    [inputs.annualRate, isValid, parsedTermMonths, principal],
  );
  const comparisons = useMemo(
    () =>
      isValid ? calculateTermRows(principal, inputs.annualRate) : [],
    [inputs.annualRate, isValid, principal],
  );

  if (view === "plan" && quote) {
    return (
      <LoanPaymentPlan
        annualRate={inputs.annualRate}
        downPayment={inputs.downPayment}
        onBack={() => setView("quote")}
        operatorCompany={operatorCompany}
        price={inputs.price}
        quote={quote}
        initialDetails={planDefaults}
        storageScope={storageScope}
      />
    );
  }

  return (
    <div className={styles.workspace}>
      <section className={styles.formCard} aria-labelledby="financing-data-title">
        <div className={styles.cardHeading}>
          <div>
            <h2 id="financing-data-title">Datos del préstamo</h2>
          </div>
          <span className={styles.localBadge}>Interés simple</span>
        </div>
        <form
          className={styles.form}
          aria-label="Datos del préstamo"
          onSubmit={(event) => event.preventDefault()}
          noValidate
        >
          <Field
            id="price"
            label="Precio total"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            error={errors.price}
            max={LOAN_LIMITS.price.max}
          />
          <Field
            id="down-payment"
            label="Enganche"
            value={downPayment}
            onChange={(event) => setDownPayment(event.target.value)}
            error={errors.downPayment}
            max={Math.min(
              Number.isFinite(inputs.price) ? inputs.price : LOAN_LIMITS.price.max,
              LOAN_LIMITS.price.max,
            )}
          />
          <Field
            id="annual-rate"
            label="Interés anual (%)"
            value={annualRate}
            onChange={(event) => setAnnualRate(event.target.value)}
            error={errors.annualRate}
            max={LOAN_LIMITS.annualRate.max}
            step="any"
          />
          <Field
            id="term-years"
            label="Plazo (años)"
            value={termYears}
            onChange={(event) => setTermYears(event.target.value)}
            hint="De 1 a 30 años"
            error={termError}
            max={30}
            step="1"
          />
        </form>
      </section>

      {quote ? (
        <section className={styles.resultCard} aria-labelledby="quote-title" aria-live="polite">
          <div className={styles.resultHeading}>
            <div>
              <h2 id="quote-title">
                {formatTerm(parsedTermMonths)}
              </h2>
            </div>
            <span>{quote.months} mensualidades</span>
          </div>
          <div className={styles.primaryQuote}>
            <span>Cuota mensual</span>
            <strong>{formatCurrency(quote.monthly)}</strong>
            <small>
              Última cuota: {formatCurrency(quote.finalPayment)}
            </small>
          </div>
          <dl className={styles.quoteBreakdown}>
            <div>
              <dt>Capital</dt>
              <dd>{formatCurrency(quote.principal)}</dd>
            </div>
            <div>
              <dt>Interés total</dt>
              <dd>{formatCurrency(quote.interestTotal)}</dd>
            </div>
            <div>
              <dt>Total programado</dt>
              <dd>{formatCurrency(quote.total)}</dd>
            </div>
            <div>
              <dt>Enganche</dt>
              <dd>{formatCurrency(inputs.downPayment)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className={styles.planButton}
            onClick={() => setView("plan")}
          >
            Preparar plan de pagos
            <span aria-hidden="true">→</span>
          </button>
        </section>
      ) : (
        <p className={styles.validationSummary} role="status">
          Corrige los campos señalados para generar la cotización.
        </p>
      )}

      {quote && (
        <section className={styles.comparison} aria-labelledby="comparison-title">
          <div className={styles.comparisonHeading}>
            <div>
              <h2 id="comparison-title">Cuota por plazo</h2>
            </div>
          </div>
          <div className={styles.termOptions}>
            {comparisons.map((row) => (
              <button
                key={row.years}
                type="button"
                aria-pressed={parsedTermYears === row.years}
                onClick={() => setTermYears(String(row.years))}
              >
                <span>{row.years} {row.years === 1 ? "año" : "años"}</span>
                <strong>{formatCurrency(row.monthly)}</strong>
                <small>Total {formatCurrency(row.total)}</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );

}

function Field({
  error,
  hint,
  id,
  label,
  max,
  onChange,
  step = "0.01",
  value,
}: {
  error?: string;
  hint?: string;
  id: string;
  label: string;
  max: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  value: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={error ? styles.invalid : undefined}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId ? `${hintId} ` : ""}${errorId}` : hintId}
      />
      {hint && <small id={hintId}>{hint}</small>}
      {error && <small id={errorId} className={styles.error} role="alert">{error}</small>}
    </div>
  );
}

function parseInput(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatTerm(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? "año" : "años"}`;
  }

  return `${months} meses`;
}
