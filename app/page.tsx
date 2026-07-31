import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownCircleIcon,
  ArrowRightIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { DashboardSearch, type DashboardSearchItem } from "@/components/dashboard-search";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { loadResourceDirectory } from "@/lib/resource-data";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Portal",
  description:
    "Calcula préstamos, registra abonos a capital y documenta ajustes de pago.",
};

export default async function HomePage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  const directory = await loadResourceDirectory(session);
  const searchItems: DashboardSearchItem[] = [
    ...directory.customers.map((customer) => ({ href: `/clientes/${customer.id}`, kind: "customer" as const, title: customer.name, subtitle: customer.accountReferences.length > 0 ? `Lotes ${customer.accountReferences.join(", ")}` : "Cliente", searchText: [customer.name, customer.phone, customer.email, ...customer.accountReferences].join(" ") })),
    ...directory.loans.map((loan) => ({ href: `/financiamientos/${loan.id}`, kind: "loan" as const, title: loan.accountReference, subtitle: loan.customerName, searchText: [loan.accountReference, loan.customerName, ...loan.documentNumbers].join(" ") })),
  ];

  return (
    <main className="appPage">
      <header className={styles.dashboardHeader}>
        <div>
          <p className={styles.dashboardEyebrow}>Panel principal</p>
          <h1 className={styles.dashboardTitle}>Inicio</h1>
          <p className={styles.dashboardIntro}>Busca un cliente, lote o documento.</p>
        </div>
      </header>

      <DashboardSearch items={searchItems} />

      <section className={styles.stats} aria-label="Resumen">
        <Link href="/clientes"><span className={styles.statIcon} aria-hidden="true"><UserGroupIcon /></span><div><strong>{directory.customers.length}</strong><span>Clientes</span></div></Link>
        <Link href="/financiamientos"><span className={styles.statIcon} aria-hidden="true"><DocumentTextIcon /></span><div><strong>{directory.loans.length}</strong><span>Financiamientos</span></div></Link>
        <div><span className={styles.statIcon} aria-hidden="true"><AdjustmentsHorizontalIcon /></span><div><strong>{directory.activities.length}</strong><span>Movimientos</span></div></div>
      </section>

      <section className={styles.operationSection} aria-label="Operaciones">
        <div className={styles.sectionHeading}><p>Acciones rápidas</p><h2>Registrar</h2></div>
        <div className={styles.operationGrid}>
          <Link className={`${styles.operationCard} ${styles.primaryCard}`} href="/financiamientos/nuevo">
            <span className={styles.operationIcon} aria-hidden="true"><DocumentPlusIcon /></span>
            <div>
              <h3>Nuevo financiamiento</h3>
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

      <section className={styles.recentSection}>
        <div className={styles.recentHeading}><div className={styles.sectionHeading}><p>Actividad</p><h2>Movimientos recientes</h2></div><Link href="/financiamientos">Ver financiamientos</Link></div>
        {directory.activities.length > 0 ? <div className={styles.activityList}>{directory.activities.slice(0, 6).map((activity) => <Link href={`/financiamientos/${activity.loanId}`} key={activity.documentNumber}>
          <span className={styles.activityIcon} aria-hidden="true">{activity.type === "loan_origination" ? "F" : activity.type === "capital_payment" ? "R" : "A"}</span>
          <span><strong>{activityLabel(activity.type)} · {activity.accountReference}</strong><small>{activity.customerName} · {activity.documentNumber}</small></span>
          <time>{formatDate(activity.effectiveDate)}</time>
        </Link>)}</div> : <p className={styles.emptyActivity}>Los movimientos registrados aparecerán aquí.</p>}
      </section>
    </main>
  );
}

function activityLabel(type: string) { return ({ loan_origination: "Financiamiento", capital_payment: "Abono", payment_adjustment: "Ajuste" } as Record<string, string>)[type] || "Movimiento"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
