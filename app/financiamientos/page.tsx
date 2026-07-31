import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdjustmentsHorizontalIcon, ArrowDownCircleIcon, DocumentPlusIcon, DocumentTextIcon, EyeIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { loadResourceDirectory, matchesSearch } from "@/lib/resource-data";
import styles from "@/components/resource-pages.module.css";

export const metadata: Metadata = { title: "Financiamientos" };

export default async function FinancingsPage({ searchParams }: { searchParams: Promise<{ buscar?: string }> }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  const [{ buscar = "" }, directory] = await Promise.all([searchParams, loadResourceDirectory(session)]);
  const loans = directory.loans.filter((loan) => matchesSearch(buscar, loan.accountReference, loan.customerName, ...loan.documentNumbers));

  return <main className="appPage">
    <header className={styles.pageHeader}>
      <div className={styles.headingCopy}><p className={styles.eyebrow}>Recursos</p><h1 className={styles.title}>Financiamientos</h1><p className={styles.intro}>Consulta cada préstamo, su plan vigente y los movimientos registrados.</p></div>
      <Link className={styles.primaryAction} href="/financiamientos/nuevo"><DocumentPlusIcon aria-hidden="true" />Nuevo financiamiento</Link>
    </header>

    <div className={styles.toolbar}>
      <form className={styles.searchForm} action="/financiamientos" role="search"><MagnifyingGlassIcon aria-hidden="true" /><input name="buscar" defaultValue={buscar} placeholder="Buscar por cliente, lote o documento…" aria-label="Buscar financiamientos" /></form>
      <span className={styles.resultCount}>{loans.length} {loans.length === 1 ? "financiamiento" : "financiamientos"}</span>
    </div>

    {loans.length > 0 ? <section className={styles.tableCard} aria-label="Lista de financiamientos">
      <table className={styles.table}>
        <thead><tr><th>Lote o cuenta</th><th>Cliente</th><th>Plan vigente</th><th>Último movimiento</th><th>Estado</th><th><span className="srOnly">Acciones</span></th></tr></thead>
        <tbody>{loans.map((loan) => <tr key={loan.id}>
          <td data-label="Lote o cuenta"><div className={styles.primaryCell}><Link href={`/financiamientos/${loan.id}`}>{loan.accountReference}</Link><span>Original {money(loan.originalPrincipal)}</span></div></td>
          <td data-label="Cliente"><div className={styles.primaryCell}><Link href={`/clientes/${loan.customerId}`}>{loan.customerName}</Link><span>Primera cuota {formatDate(loan.firstDueDate)}</span></div></td>
          <td data-label="Plan vigente"><div className={styles.primaryCell}><strong>{money(loan.currentPrincipal)}</strong><span>{loan.remainingMonths} cuotas · {money(loan.regularPayment)}</span></div></td>
          <td data-label="Último movimiento"><div className={styles.primaryCell}><strong>{loan.latestActivity ? activityLabel(loan.latestActivity.type) : "Financiamiento"}</strong><span>{loan.latestActivity ? `${loan.latestActivity.documentNumber} · ${formatDate(loan.latestActivity.effectiveDate)}` : "Sin movimientos"}</span></div></td>
          <td data-label="Estado"><span className={styles.statusBadge}>Activo</span></td>
          <td data-label="Acciones"><div className={styles.actions}>
            <Link className={`${styles.rowAction} ${styles.actionIconOnly}`} href={`/financiamientos/${loan.id}`} title="Ver financiamiento" aria-label={`Ver financiamiento ${loan.accountReference}`}><EyeIcon aria-hidden="true" /></Link>
            <Link className={styles.contextAction} href={`/abono-capital?financiamiento=${loan.id}`} title="Registrar abono"><ArrowDownCircleIcon aria-hidden="true" /><span>Abono</span></Link>
            <Link className={styles.contextAction} href={`/ajustes?financiamiento=${loan.id}`} title="Registrar ajuste"><AdjustmentsHorizontalIcon aria-hidden="true" /><span>Ajuste</span></Link>
          </div></td>
        </tr>)}</tbody>
      </table>
    </section> : <section className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true"><DocumentTextIcon /></span>
      <h2>{buscar ? "No encontramos financiamientos" : "Registra tu primer financiamiento"}</h2>
      <p>{buscar ? "Prueba con el nombre del cliente, la referencia del lote o un número de documento." : "Los financiamientos aparecerán aquí con su plan vigente y actividad reciente."}</p>
      {!buscar && <Link className={styles.primaryAction} href="/financiamientos/nuevo">Nuevo financiamiento</Link>}
    </section>}
  </main>;
}

function activityLabel(type: string) { return ({ loan_origination: "Financiamiento", capital_payment: "Abono a capital", payment_adjustment: "Ajuste" } as Record<string, string>)[type] || "Movimiento"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function money(value: number) { return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", currencyDisplay: "narrowSymbol" }).format(value); }
