import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Portal",
  description:
    "Calcula préstamos, registra abonos a capital y documenta ajustes de pago.",
};

export default function HomePage() {
  return (
    <main className="appPage">
      <header className={styles.dashboardHeader}>
        <div>
          <p className="pageEyebrow">Portal</p>
          <h1 className={styles.dashboardTitle}>Portal de créditos</h1>
          <p className={styles.dashboardIntro}>
            Elige la operación que deseas realizar.
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
          <p>Operaciones</p>
          <h2 id="operations-title">Comenzar</h2>
        </div>

        <div className={styles.operationGrid}>
          <Link className={`${styles.operationCard} ${styles.primaryCard}`} href="/financiamiento">
            <span className={styles.operationIcon} aria-hidden="true">+</span>
            <div>
              <p>Nuevo préstamo</p>
              <h3>Cotizar préstamo</h3>
              <span>
                Calcula cuota, interés y total; prepara el plan de pagos.
              </span>
            </div>
            <strong>Abrir cotizador <span aria-hidden="true">→</span></strong>
          </Link>

          <Link className={styles.operationCard} href="/abono-capital">
            <span className={styles.operationIcon} aria-hidden="true">↓</span>
            <div>
              <p>Préstamo vigente</p>
              <h3>Registrar abono</h3>
              <span>
                Actualiza el saldo y entrega el comprobante y el nuevo plan.
              </span>
            </div>
            <strong>Abrir registro <span aria-hidden="true">→</span></strong>
          </Link>

          <Link className={styles.operationCard} href="/ajustes">
            <span className={styles.operationIcon} aria-hidden="true">±</span>
            <div>
              <p>Saldo a favor</p>
              <h3>Ajustar un pago</h3>
              <span>
                Aplica un excedente a la próxima cuota y prepara la constancia.
              </span>
            </div>
            <strong>Abrir ajuste <span aria-hidden="true">→</span></strong>
          </Link>
        </div>
      </section>

      <aside className={styles.rules} aria-label="Condiciones de cálculo">
        <Rule label="Moneda" value="Quetzales" />
        <Rule label="Interés" value="Simple" />
        <Rule label="Período" value="Meses completos" />
        <Rule label="Ajustes" value="Saldo a favor" />
      </aside>
    </main>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
