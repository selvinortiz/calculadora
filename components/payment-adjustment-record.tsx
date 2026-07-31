import type { PaymentCreditAdjustment } from "@/lib/finance";
import styles from "./payment-adjustment-record.module.css";

export type PaymentAdjustmentRecordDetails = {
  debtorName: string;
  creditorName: string;
  accountReference: string;
  documentNumber: string;
  adjustedBy: string;
  paymentReference: string;
  notes: string;
};

type PaymentAdjustmentRecordProps = {
  adjustment: PaymentCreditAdjustment;
  details: PaymentAdjustmentRecordDetails;
  issueDate: string;
  nextPaymentDate: string;
  paymentDate: string;
  unposted?: boolean;
};

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PaymentAdjustmentRecord({
  adjustment,
  details,
  issueDate,
  nextPaymentDate,
  paymentDate,
  unposted = false,
}: PaymentAdjustmentRecordProps) {
  return (
    <article className={styles.document} data-print-document>
      <header className={styles.header}>
        <div>
          <p>Calculadora de Créditos · Interés simple</p>
          <h2>Constancia de ajuste de pago</h2>
        </div>
        <div className={styles.documentMeta}>
          <span>{unposted ? "BORRADOR" : "AJUSTE"}</span>
          <strong>
            {!unposted && details.documentNumber
              ? `No. ${details.documentNumber}`
              : "Sin número"}
          </strong>
          <small>{formatDate(issueDate)}</small>
        </div>
      </header>

      <p className={styles.notice}>
        El saldo a favor se aplica únicamente a la cuota siguiente. No modifica el capital, el interés ni la fecha final del financiamiento.
      </p>

      <section className={styles.identityGrid} aria-label="Datos del financiamiento">
        <DocumentItem label="Deudor" value={details.debtorName || "No indicado"} />
        <DocumentItem label="Acreedor" value={details.creditorName || "No indicado"} />
        <DocumentItem label="Lote o cuenta" value={details.accountReference || "No indicado"} />
        <DocumentItem label="Fecha de emisión" value={formatDate(issueDate)} />
      </section>

      <section className={styles.section}>
        <h3>Pago revisado</h3>
        <div className={styles.paymentGrid}>
          <DocumentItem label="Cuota" value={String(adjustment.paymentNumber)} />
          <DocumentItem label="Fecha del pago" value={formatDate(paymentDate)} />
          <DocumentItem
            label="Monto programado"
            value={formatCurrency(adjustment.scheduledPayment)}
          />
          <DocumentItem
            label="Pago recibido"
            value={formatCurrency(adjustment.receivedPayment)}
          />
        </div>
      </section>

      <section className={styles.application} aria-label="Aplicación del saldo a favor">
        <div className={styles.applicationHeading}>
          <span>Aplicación a la cuota siguiente</span>
          <small>El excedente se reconoce como anticipo de la cuota {adjustment.nextPaymentNumber}.</small>
        </div>
        <div className={styles.formula}>
          <FormulaValue label="Pago recibido" value={formatCurrency(adjustment.receivedPayment)} />
          <span aria-hidden="true">−</span>
          <FormulaValue label="Cuota programada" value={formatCurrency(adjustment.scheduledPayment)} />
          <span aria-hidden="true">=</span>
          <FormulaValue label="Saldo a favor" value={formatCurrency(adjustment.creditBalance)} emphasized />
        </div>
      </section>

      <section className={styles.section}>
        <h3>Cuotas afectadas</h3>
        <div className={styles.tableRegion}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Cuota</th>
                <th scope="col">Fecha</th>
                <th scope="col">Programado</th>
                <th scope="col">Saldo aplicado</th>
                <th scope="col">Por recibir</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{adjustment.paymentNumber}</th>
                <td>{formatDate(paymentDate)}</td>
                <td>{formatCurrency(adjustment.scheduledPayment)}</td>
                <td>—</td>
                <td className={styles.status}>Pagada</td>
              </tr>
              <tr className={styles.adjustedRow}>
                <th scope="row">{adjustment.nextPaymentNumber}</th>
                <td>{formatDate(nextPaymentDate)}</td>
                <td>{formatCurrency(adjustment.scheduledPayment)}</td>
                <td>−{formatCurrency(adjustment.creditBalance)}</td>
                <td>{formatCurrency(adjustment.adjustedNextPayment)}</td>
              </tr>
              <tr>
                <th scope="row">Desde la {adjustment.followingPaymentNumber}</th>
                <td>Según el plan vigente</td>
                <td>{formatCurrency(adjustment.regularPaymentAfterAdjustment)}</td>
                <td>—</td>
                <td>{formatCurrency(adjustment.regularPaymentAfterAdjustment)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.summary} aria-label="Resumen del ajuste">
        <SummaryItem label="Saldo a favor" value={formatCurrency(adjustment.creditBalance)} />
        <SummaryItem label={`Cuota ${adjustment.nextPaymentNumber} por recibir`} value={formatCurrency(adjustment.adjustedNextPayment)} emphasized />
        <SummaryItem label={`Cuota regular desde la ${adjustment.followingPaymentNumber}`} value={formatCurrency(adjustment.regularPaymentAfterAdjustment)} />
      </section>

      <section className={styles.unchanged}>
        <h3>Sin cambios</h3>
        <div>
          <span>Capital</span>
          <span>Interés</span>
          <span>Cuota regular</span>
          <span>Fecha final</span>
        </div>
      </section>

      {(details.paymentReference || details.adjustedBy || details.notes) && (
        <section className={styles.detailGrid}>
          <DocumentItem label="Referencia del pago" value={details.paymentReference || "No indicada"} />
          <DocumentItem label="Ajustado por" value={details.adjustedBy || "No indicado"} />
          <DocumentItem label="Observaciones" value={details.notes || "Ninguna"} />
        </section>
      )}

      <footer className={styles.signatures}>
        <div>
          <span>Firma del acreedor o responsable</span>
          <small>{details.adjustedBy || details.creditorName}</small>
        </div>
        <div>
          <span>Firma del deudor</span>
          <small>{details.debtorName}</small>
        </div>
      </footer>

      <footer className={styles.documentFooter}>
        <span>Preparado con Calculadora de Créditos</span>
        <span>Conservar con el plan de pagos vigente.</span>
      </footer>
    </article>
  );
}

function DocumentItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.documentItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormulaValue({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div data-emphasized={emphasized ? "true" : undefined}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryItem({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div data-emphasized={emphasized ? "true" : undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: string): string {
  if (!value) return "Sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
