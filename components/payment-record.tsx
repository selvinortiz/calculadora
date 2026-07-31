import type { SimpleInterestRecalculation } from "@/lib/finance";
import styles from "./payment-record.module.css";

export type TransactionMode = "standalone" | "combined";
export type DocumentType = "simulation" | "record";

export type RecordDetails = {
  documentType: DocumentType;
  debtorName: string;
  creditorName: string;
  lotReference: string;
  receiptNumber: string;
  paymentMethod: string;
  paymentReference: string;
  receivedBy: string;
  notes: string;
};

type PaymentRecordProps = {
  annualRate: number;
  balanceSource: "calculated" | "statement";
  capitalPayment: number;
  details: RecordDetails;
  downPayment: number;
  lastPaymentDate: string;
  nextPaymentDate: string;
  paymentNumber: number;
  price: number;
  result: SimpleInterestRecalculation;
  termMonths: number;
  transactionDate: string;
  transactionMode: TransactionMode;
  unposted?: boolean;
};

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PaymentRecord({
  annualRate,
  balanceSource,
  capitalPayment,
  details,
  downPayment,
  lastPaymentDate,
  nextPaymentDate,
  paymentNumber,
  price,
  result,
  termMonths,
  transactionDate,
  transactionMode,
  unposted = false,
}: PaymentRecordProps) {
  const isRecord = details.documentType === "record" && !unposted;
  const transactionTotal =
    transactionMode === "combined"
      ? result.regularPayment + capitalPayment
      : capitalPayment;

  return (
    <article className={styles.document} data-print-document>
      <header className={styles.header}>
        <div>
          <p>Calculadora de Créditos · Interés simple</p>
          <h2>
            {isRecord
              ? "Recibo de abono a capital"
              : "Simulación de abono a capital"}
          </h2>
        </div>
        <div className={styles.documentMeta}>
          <span>{isRecord ? "RECIBO" : "SIMULACIÓN"}</span>
          <strong>{details.receiptNumber ? `No. ${details.receiptNumber}` : "Sin número"}</strong>
        </div>
      </header>

      {!isRecord && (
        <p className={styles.warning}>
          Documento informativo. No constituye comprobante de pago ni confirma la recepción de fondos.
        </p>
      )}

      <section className={styles.identityGrid} aria-label="Datos de las partes">
        <RecordItem label="Deudor" value={details.debtorName || "No indicado"} />
        <RecordItem label="Acreedor" value={details.creditorName || "No indicado"} />
        <RecordItem label="Lote o cuenta" value={details.lotReference || "No indicado"} />
        <RecordItem label="Fecha del abono" value={formatDate(transactionDate)} />
      </section>

      <section className={styles.section}>
        <h3>Movimiento registrado</h3>
        <div className={styles.transactionGrid}>
          <RecordItem
            label={
              transactionMode === "standalone"
                ? `Última cuota pagada: ${paymentNumber}`
                : `Cuota regular: ${paymentNumber}`
            }
            value={
              transactionMode === "standalone"
                ? formatDate(lastPaymentDate)
                : formatCurrency(result.regularPayment)
            }
          />
          <RecordItem label="Abono a capital" value={formatCurrency(capitalPayment)} />
          <RecordItem label="Total de esta transacción" value={formatCurrency(transactionTotal)} />
          <RecordItem label="Próxima cuota" value={`${paymentNumber + 1} · ${formatDate(nextPaymentDate)}`} />
        </div>
      </section>

      <section className={styles.capitalApplication} aria-label="Aplicación del abono">
        <div>
          <span>Aplicación directa a capital</span>
          <small>El abono se aplica únicamente al capital pendiente.</small>
        </div>
        <div className={styles.capitalFormula}>
          <FormulaValue label="Capital anterior" value={formatCurrency(result.currentCapital)} />
          <span aria-hidden="true">−</span>
          <FormulaValue label="Abono" value={formatCurrency(capitalPayment)} />
          <span aria-hidden="true">=</span>
          <FormulaValue label="Nuevo capital" value={formatCurrency(result.newCapital)} emphasized />
        </div>
      </section>

      <section className={styles.section}>
        <h3>Antes y después del abono</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Antes</th>
              <th scope="col">Después</th>
            </tr>
          </thead>
          <tbody>
            <RecordRow
              label="Saldo de capital"
              before={formatCurrency(result.currentCapital)}
              after={formatCurrency(result.newCapital)}
            />
            <RecordRow
              label="Interés futuro"
              before={formatCurrency(result.originalFutureInterest)}
              after={formatCurrency(result.newFutureInterest)}
            />
            <RecordRow
              label="Saldo total programado"
              before={formatCurrency(result.originalScheduledBalance)}
              after={formatCurrency(result.newScheduledBalance)}
            />
            <RecordRow
              label="Cuota mensual"
              before={formatCurrency(result.regularPayment)}
              after={formatCurrency(result.newMonthlyPayment)}
            />
            <RecordRow
              label="Cuotas restantes"
              before={String(result.remainingMonths)}
              after={String(result.remainingMonths)}
            />
          </tbody>
        </table>
      </section>

      <section className={styles.summary}>
        <div>
          <span>Nuevo capital</span>
          <strong>{formatCurrency(result.newCapital)}</strong>
        </div>
        <div>
          <span>Nueva cuota</span>
          <strong>{formatCurrency(result.newMonthlyPayment)}</strong>
        </div>
        <div>
          <span>Total futuro programado</span>
          <strong>{formatCurrency(result.newScheduledBalance)}</strong>
        </div>
        <div>
          <span>Intereses reducidos</span>
          <strong>{formatCurrency(result.totalInterestReduction)}</strong>
        </div>
      </section>

      <section className={styles.terms}>
        <h3>Base del cálculo</h3>
        <p>
          Precio {formatCurrency(price)} · Enganche {formatCurrency(downPayment)} · {" "}
          Tasa anual {formatRate(annualRate)}% · Plazo original {termMonths} meses.
          Capital pendiente: {balanceSource === "statement" ? "saldo ingresado" : "cálculo con las cuotas pagadas"}. {" "}
          El interés futuro se calcula como nuevo capital × tasa anual × tiempo restante. La última cuota es {formatCurrency(result.newFinalPayment)} para reconciliar el redondeo.
        </p>
        <p className={styles.definitionNote}>
          <strong>Saldo de capital</strong> es el principal pendiente. {" "}
          <strong>Total futuro programado</strong> incluye ese capital más el interés futuro.
        </p>
      </section>

      {(details.paymentMethod || details.paymentReference || details.receivedBy || details.notes) && (
        <section className={styles.detailGrid}>
          <RecordItem label="Medio de pago" value={details.paymentMethod || "No indicado"} />
          <RecordItem label="Referencia" value={details.paymentReference || "No indicada"} />
          <RecordItem label="Recibido por" value={details.receivedBy || "No indicado"} />
          <RecordItem label="Observaciones" value={details.notes || "Ninguna"} />
        </section>
      )}

      {isRecord && (
        <footer className={styles.signatures}>
          <div>
            <span>Firma del acreedor o receptor</span>
            <small>{details.receivedBy || details.creditorName}</small>
          </div>
          <div>
            <span>Firma del deudor</span>
            <small>{details.debtorName}</small>
          </div>
        </footer>
      )}

      <footer className={styles.documentFooter}>
        <span>Preparado con Calculadora de Créditos</span>
        <span>{isRecord ? "Conservar con el expediente del préstamo." : "Revisar antes de compartir con el cliente."}</span>
      </footer>
    </article>
  );
}

function RecordItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.recordItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormulaValue({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return (
    <div data-emphasized={emphasized ? "true" : undefined}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function RecordRow({
  after,
  before,
  label,
}: {
  after: string;
  before: string;
  label: string;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{before}</td>
      <td>{after}</td>
    </tr>
  );
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatRate(value: number): string {
  return value.toLocaleString("es-GT", { maximumFractionDigits: 4 });
}

function formatDate(value: string): string {
  if (!value) return "No indicada";

  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
