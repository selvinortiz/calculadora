import type { Metadata } from "next";
import Link from "next/link";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownCircleIcon,
  ArrowRightIcon,
  DocumentPlusIcon,
} from "@heroicons/react/24/outline";
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
          <h1 className={styles.dashboardTitle}>¿Qué deseas hacer?</h1>
        </div>
      </header>

      <section className={styles.operationSection} aria-label="Operaciones">
        <div className={styles.operationGrid}>
          <Link className={`${styles.operationCard} ${styles.primaryCard}`} href="/financiamiento">
            <span className={styles.operationIcon} aria-hidden="true"><DocumentPlusIcon /></span>
            <div>
              <h3>Nuevo préstamo</h3>
              <span>Calcula la cuota y el plan de pagos.</span>
            </div>
            <strong>Cotizar <ArrowRightIcon aria-hidden="true" /></strong>
          </Link>

          <Link className={styles.operationCard} href="/abono-capital">
            <span className={styles.operationIcon} aria-hidden="true"><ArrowDownCircleIcon /></span>
            <div>
              <h3>Abono a capital</h3>
              <span>Recalcula el saldo y la cuota.</span>
            </div>
            <strong>Registrar <ArrowRightIcon aria-hidden="true" /></strong>
          </Link>

          <Link className={styles.operationCard} href="/ajustes">
            <span className={styles.operationIcon} aria-hidden="true"><AdjustmentsHorizontalIcon /></span>
            <div>
              <h3>Ajuste de pago</h3>
              <span>Aplica un saldo a favor a la próxima cuota.</span>
            </div>
            <strong>Ajustar <ArrowRightIcon aria-hidden="true" /></strong>
          </Link>
        </div>
      </section>

    </main>
  );
}
