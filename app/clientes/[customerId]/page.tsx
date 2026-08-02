import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowDownCircleIcon, AdjustmentsHorizontalIcon, DocumentPlusIcon, EyeIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { loadResourceDirectory } from "@/lib/resource-data";
import styles from "@/components/resource-pages.module.css";

export const metadata: Metadata = { title: "Cliente" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  const [{ customerId }, directory] = await Promise.all([params, loadResourceDirectory(session)]);
  const customer = directory.customers.find((item) => item.id === customerId);
  if (!customer) notFound();
  const loans = directory.loans.filter((loan) => loan.customerId === customer.id);

  return <main className="appPage">
    <nav className={styles.breadcrumbs} aria-label="Migas de pan"><Link href="/clientes">Clientes</Link><span>/</span><span>{customer.name}</span></nav>
    <header className={styles.pageHeader}>
      <div className={styles.headingCopy}><p className={styles.eyebrow}>Cliente</p><h1 className={styles.title}>{customer.name}</h1><p className={styles.intro}>{loans.length} {loans.length === 1 ? "financiamiento activo" : "financiamientos activos"}</p></div>
      <div className={styles.headerActions}>
        <Link className={styles.secondaryAction} href={`/clientes/${customer.id}/editar`}><PencilSquareIcon aria-hidden="true" />Editar</Link>
        <Link className={styles.primaryAction} href={`/financiamientos/nuevo?cliente=${customer.id}`}><DocumentPlusIcon aria-hidden="true" />Nuevo financiamiento</Link>
      </div>
    </header>

    <div className={styles.detailGrid}>
      <section className={styles.detailCard}>
        <div className={styles.sectionHeader}><div><p className={styles.sectionEyebrow}>Información</p><h2>Datos del cliente</h2></div></div>
        <dl className={styles.contactList}>
          <div><dt>Nombre</dt><dd>{customer.name}</dd></div>
          <div><dt>Teléfono</dt><dd>{customer.phone || "Sin teléfono"}</dd></div>
          <div><dt>Correo</dt><dd>{customer.email || "Sin correo"}</dd></div>
          <div><dt>Última actividad</dt><dd>{formatDate(customer.latestActivityAt)}</dd></div>
        </dl>
      </section>

      <section className={styles.tableCard} aria-label="Financiamientos del cliente">
        <div className={`${styles.sectionHeader} ${styles.insetSectionHeader}`}><div><p className={styles.sectionEyebrow}>Financiamientos</p><h2>{loans.length > 0 ? "Lotes y cuentas" : "Sin financiamientos"}</h2></div></div>
        {loans.length > 0 ? <table className={styles.table}>
          <thead><tr><th>Referencia</th><th>Capital del plan</th><th>Cuota regular</th><th><span className="srOnly">Acciones</span></th></tr></thead>
          <tbody>{loans.map((loan) => <tr key={loan.id}>
            <td data-label="Referencia"><div className={styles.primaryCell}><Link href={`/financiamientos/${loan.id}`}>{loan.accountReference}</Link><span>{loan.latestActivity?.documentNumber || "Financiamiento"}</span></div></td>
            <td data-label="Capital del plan">{money(loan.currentPrincipal)}</td>
            <td data-label="Cuota regular">{money(loan.regularPayment)}</td>
            <td data-label="Acciones"><div className={styles.actions}>
              <Link className={`${styles.rowAction} ${styles.actionIconOnly}`} href={`/financiamientos/${loan.id}`} title="Ver financiamiento" aria-label={`Ver financiamiento ${loan.accountReference}`}><EyeIcon aria-hidden="true" /><span className={styles.actionLabel}>Ver</span></Link>
              <Link className={`${styles.contextAction} ${styles.actionIconOnly}`} href={`/abono-capital?financiamiento=${loan.id}`} title="Registrar abono" aria-label={`Registrar abono para ${loan.accountReference}`}><ArrowDownCircleIcon aria-hidden="true" /><span className={styles.actionLabel}>Abono</span></Link>
              <Link className={`${styles.contextAction} ${styles.actionIconOnly}`} href={`/ajustes?financiamiento=${loan.id}`} title="Registrar ajuste" aria-label={`Registrar ajuste para ${loan.accountReference}`}><AdjustmentsHorizontalIcon aria-hidden="true" /><span className={styles.actionLabel}>Ajuste</span></Link>
            </div></td>
          </tr>)}</tbody>
        </table> : <div className={`${styles.emptyState} ${styles.embeddedEmpty}`}><p>Este cliente todavía no tiene financiamientos.</p><Link className={styles.primaryAction} href={`/financiamientos/nuevo?cliente=${customer.id}`}>Crear financiamiento</Link></div>}
      </section>
    </div>
  </main>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value)); }
function money(value: number) { return new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", currencyDisplay: "narrowSymbol" }).format(value); }
