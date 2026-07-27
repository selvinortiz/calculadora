import type { PaymentScheduleRow } from "@/lib/finance";
import styles from "./payment-schedule-document.module.css";

type PaymentScheduleDocumentProps = {
  accountReference: string;
  annualRate: number;
  capitalPayment?: number;
  creditorName: string;
  debtorName: string;
  downPayment: number;
  finalPayment: number;
  interestTotal: number;
  issueDate: string;
  monthlyPayment: number;
  originalTermMonths: number;
  previousPaymentNumber?: number;
  previousPrincipal?: number;
  price: number;
  principal: number;
  rows: PaymentScheduleRow[];
  scheduledTotal: number;
  variant: "original" | "updated";
};

const currencyFormatter = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "GTQ",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PaymentScheduleDocument({
  accountReference,
  annualRate,
  capitalPayment,
  creditorName,
  debtorName,
  downPayment,
  finalPayment,
  interestTotal,
  issueDate,
  monthlyPayment,
  originalTermMonths,
  previousPaymentNumber,
  previousPrincipal,
  price,
  principal,
  rows,
  scheduledTotal,
  variant,
}: PaymentScheduleDocumentProps) {
  const isUpdated = variant === "updated";
  const firstRow = rows[0];
  const lastRow = rows.at(-1);

  return (
    <article className={styles.document} data-print-document>
      <header className={styles.header}>
        <div>
          <p>Calculadora de Créditos · Interés simple</p>
          <h2>{isUpdated ? "Plan de pagos actualizado" : "Plan de pagos"}</h2>
        </div>
        <div className={styles.documentMeta}>
          <span>EMITIDO</span>
          <strong>{formatDate(issueDate)}</strong>
        </div>
      </header>

      <p className={styles.notice}>
        {isUpdated
          ? `Este plan reemplaza únicamente las cuotas futuras a partir de la cuota ${firstRow?.paymentNumber ?? "—"}. Los pagos anteriores permanecen sin cambios.`
          : "Las fechas indicadas son las fechas de vencimiento de cada cuota. Este documento no acredita pagos recibidos."}
      </p>

      <section className={styles.identityGrid} aria-label="Datos del préstamo">
        <DocumentItem label="Deudor" value={debtorName || "No indicado"} />
        <DocumentItem label="Acreedor" value={creditorName || "No indicado"} />
        <DocumentItem label="Lote o cuenta" value={accountReference || "No indicado"} />
        <DocumentItem
          label="Primera cuota de este plan"
          value={firstRow ? `${firstRow.paymentNumber} · ${formatDate(firstRow.dueDate)}` : "Sin fecha"}
        />
      </section>

      <section className={styles.summary} aria-label="Resumen del plan">
        {isUpdated ? (
          <>
            <SummaryItem label="Capital antes del abono" value={formatCurrency(previousPrincipal ?? principal)} />
            <SummaryItem label="Abono aplicado" value={formatCurrency(capitalPayment ?? 0)} />
            <SummaryItem label="Nuevo capital" value={formatCurrency(principal)} emphasized />
            <SummaryItem label="Total futuro" value={formatCurrency(scheduledTotal)} />
          </>
        ) : (
          <>
            <SummaryItem label="Precio" value={formatCurrency(price)} />
            <SummaryItem label="Enganche" value={formatCurrency(downPayment)} />
            <SummaryItem label="Capital financiado" value={formatCurrency(principal)} emphasized />
            <SummaryItem label="Total programado" value={formatCurrency(scheduledTotal)} />
          </>
        )}
      </section>

      <section className={styles.paymentTerms}>
        <div>
          <span>Cuotas de este plan</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Cuota mensual</span>
          <strong>{formatCurrency(monthlyPayment)}</strong>
        </div>
        <div>
          <span>Última cuota</span>
          <strong>{formatCurrency(finalPayment)}</strong>
        </div>
        <div>
          <span>Interés de este plan</span>
          <strong>{formatCurrency(interestTotal)}</strong>
        </div>
      </section>

      <section className={styles.scheduleSection} aria-labelledby="schedule-table-title">
        <div className={styles.sectionHeading}>
          <div>
            <h3 id="schedule-table-title">Calendario de cuotas</h3>
            <p>
              Del {formatDate(firstRow?.dueDate ?? "")} al {formatDate(lastRow?.dueDate ?? "")}.
            </p>
          </div>
          <span>{formatRate(annualRate)}% anual · {originalTermMonths} meses originales</span>
        </div>

        <div className={styles.tableRegion} role="region" aria-label="Tabla del plan de pagos" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Cuota</th>
                <th scope="col">Vencimiento</th>
                <th scope="col">Capital</th>
                <th scope="col">Interés</th>
                <th scope="col">Total</th>
                <th scope="col">Capital pendiente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.paymentNumber}>
                  <th scope="row">{row.paymentNumber}</th>
                  <td>{formatDate(row.dueDate)}</td>
                  <td>{formatCurrency(row.principal)}</td>
                  <td>{formatCurrency(row.interest)}</td>
                  <td>{formatCurrency(row.payment)}</td>
                  <td>{formatCurrency(row.remainingPrincipal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>Totales</th>
                <td>{formatCurrency(principal)}</td>
                <td>{formatCurrency(interestTotal)}</td>
                <td>{formatCurrency(scheduledTotal)}</td>
                <td>{formatCurrency(0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className={styles.terms}>
        <h3>Condiciones de este plan</h3>
        <p>
          {isUpdated
            ? `El abono se aplicó directamente al capital después de la cuota ${previousPaymentNumber ?? "—"}. El interés de las cuotas futuras se calculó sobre el nuevo capital durante ${rows.length} meses.`
            : "El interés total se calculó sobre el capital financiado, la tasa anual y el plazo acordado."}
          {" "}Los montos se muestran en quetzales y la última cuota concilia cualquier diferencia de redondeo.
        </p>
      </section>

      <footer className={styles.signatures}>
        <div>
          <span>Entregado por el acreedor</span>
          <small>{creditorName || "Nombre y firma"}</small>
        </div>
        <div>
          <span>Recibido por el deudor</span>
          <small>{debtorName || "Nombre y firma"}</small>
        </div>
      </footer>

      <footer className={styles.documentFooter}>
        <span>Preparado con Calculadora de Créditos</span>
        <span>Conservar con el expediente del préstamo.</span>
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
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 4 }).format(value);
}
