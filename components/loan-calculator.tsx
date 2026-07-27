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

export function LoanCalculator({ operatorCompany }: { operatorCompany: string }) {
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
  const termError =
    !Number.isInteger(parsedTermYears) || parsedTermYears < 1 || parsedTermYears > 30
      ? "Selecciona un plazo entre 1 y 30 años."
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
            parsedTermYears * 12,
          )
        : null,
    [inputs.annualRate, isValid, parsedTermYears, principal],
  );
  const comparisons = useMemo(
    () =>
      isValid ? calculateTermRows(principal, inputs.annualRate) : [],
    [inputs.annualRate, isValid, principal],
  );

  return (
    <div className={styles.workspace}>
      <section className={styles.formCard} aria-labelledby="financing-data-title">
        <div className={styles.cardHeading}>
          <div>
            <p className={styles.stepLabel}>Préstamo</p>
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
            hint="Precio de contado del bien"
            error={errors.price}
            max={LOAN_LIMITS.price.max}
          />
          <Field
            id="down-payment"
            label="Enganche"
            value={downPayment}
            onChange={(event) => setDownPayment(event.target.value)}
            hint="Pago inicial"
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
            hint="Tasa simple anual"
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
              <p className={styles.stepLabel}>Cotización</p>
              <h2 id="quote-title">
                {parsedTermYears} {parsedTermYears === 1 ? "año" : "años"}
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
          <p className={styles.formula}>
            Interés = capital × {formatRate(inputs.annualRate)}% × {" "}
            {parsedTermYears} {parsedTermYears === 1 ? "año" : "años"}.
          </p>
        </section>
      ) : (
        <p className={styles.validationSummary} role="status">
          Corrige los campos señalados para generar la cotización.
        </p>
      )}

      {quote && (
        <details className={styles.comparison}>
          <summary>Comparar plazos de uno a cinco años</summary>
          <p className={styles.scrollHint}>Desliza para ver todas las columnas.</p>
          <div
            className={styles.tableRegion}
            role="region"
            aria-label="Comparación de plazos"
            tabIndex={0}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Plazo</th>
                  <th scope="col">Capital</th>
                  <th scope="col">Interés</th>
                  <th scope="col">Total</th>
                  <th scope="col">Cuota</th>
                  <th scope="col">Última</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row) => (
                  <tr key={row.years}>
                    <th scope="row">{row.years} {row.years === 1 ? "año" : "años"}</th>
                    <td>{formatCurrency(row.principal)}</td>
                    <td>{formatCurrency(row.interestTotal)}</td>
                    <td>{formatCurrency(row.total)}</td>
                    <td>{formatCurrency(row.monthly)}</td>
                    <td>{formatCurrency(row.finalPayment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {quote && (
        <LoanPaymentPlan
          annualRate={inputs.annualRate}
          downPayment={inputs.downPayment}
          operatorCompany={operatorCompany}
          price={inputs.price}
          quote={quote}
        />
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
  hint: string;
  id: string;
  label: string;
  max: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  value: string;
}) {
  const hintId = `${id}-hint`;
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
        aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
      />
      <small id={hintId}>{hint}</small>
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

function formatRate(value: number): string {
  return value.toLocaleString("es-GT", { maximumFractionDigits: 4 });
}
