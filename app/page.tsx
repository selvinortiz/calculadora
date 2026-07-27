import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Portal",
  description:
    "Calcula préstamos y registra abonos a capital con interés simple.",
};

export default function HomePage() {
  return (
    <main className="appPage">
      <header className={styles.dashboardHeader}>
        <div>
          <p className="pageEyebrow">Portal</p>
          <h1 className={styles.dashboardTitle}>Calculadora para prestamistas</h1>
          <p className={styles.dashboardIntro}>
            Cotiza préstamos, registra abonos y entrega documentos claros.
          </p>
        </div>
        <div className={styles.sessionStatus} aria-label="Moneda y tipo de interés">
          <span aria-hidden="true" />
          <div>
            <small>Moneda y cálculo</small>
            <strong>GTQ · Interés simple</strong>
          </div>
        </div>
      </header>

      <section className={styles.operationSection} aria-labelledby="operations-title">
        <div className={styles.sectionHeading}>
          <div>
            <p>Calculadoras</p>
            <h2 id="operations-title">¿Qué quieres calcular?</h2>
          </div>
        </div>

        <div className={styles.operationGrid}>
          <Link className={`${styles.operationCard} ${styles.primaryCard}`} href="/financiamiento">
            <span className={styles.operationIcon} aria-hidden="true">+</span>
            <div>
              <p>Nuevo préstamo</p>
              <h3>Calcular un préstamo</h3>
              <span>
                Obtén la cuota mensual, el interés y el total a pagar a partir del
                precio, enganche, tasa y plazo; después prepara el plan de pagos.
              </span>
            </div>
            <strong>Calcular préstamo <span aria-hidden="true">→</span></strong>
          </Link>

          <Link className={styles.operationCard} href="/abono-capital">
            <span className={styles.operationIcon} aria-hidden="true">↓</span>
            <div>
              <p>Préstamo vigente</p>
              <h3>Recalcular un abono a capital</h3>
              <span>
                Actualiza el capital, los intereses y la cuota; después prepara un
                comprobante y el nuevo plan de pagos.
              </span>
            </div>
            <strong>Registrar abono <span aria-hidden="true">→</span></strong>
          </Link>
        </div>
      </section>

      <div className={styles.supportGrid}>
        <section className={styles.supportCard} aria-labelledby="prepare-title">
          <div className={styles.cardHeading}>
            <span className={styles.smallIcon} aria-hidden="true">✓</span>
            <div>
              <p>Antes de comenzar</p>
              <h2 id="prepare-title">Información que necesitarás</h2>
            </div>
          </div>
          <ol className={styles.checklist}>
            <li>
              <span>1</span>
              <div>
                <strong>Datos del préstamo</strong>
                <small>Precio, enganche, tasa simple y plazo original.</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Historial de pagos</strong>
                <small>Última cuota pagada y fechas del abono.</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Datos para los documentos</strong>
                <small>Deudor, cuenta o lote, recibo, fechas y medio de pago.</small>
              </div>
            </li>
          </ol>
        </section>

        <aside className={styles.supportCard} aria-labelledby="rules-title">
          <div className={styles.cardHeading}>
            <span className={styles.smallIcon} aria-hidden="true">i</span>
            <div>
              <p>Cómo funciona</p>
              <h2 id="rules-title">Reglas del cálculo</h2>
            </div>
          </div>
          <dl className={styles.ruleList}>
            <div><dt>Moneda</dt><dd>Quetzales (GTQ)</dd></div>
            <div><dt>Interés</dt><dd>Simple por meses completos</dd></div>
            <div><dt>Abono</dt><dd>Se aplica directamente a capital</dd></div>
            <div><dt>Plazo</dt><dd>Mantiene la fecha final del préstamo</dd></div>
          </dl>
        </aside>
      </div>
    </main>
  );
}
