import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EyeIcon, MagnifyingGlassIcon, PencilSquareIcon, UserGroupIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { loadResourceDirectory, matchesSearch } from "@/lib/resource-data";
import styles from "@/components/resource-pages.module.css";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ buscar?: string }> }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  const [{ buscar = "" }, directory] = await Promise.all([searchParams, loadResourceDirectory(session)]);
  const customers = directory.customers.filter((customer) => matchesSearch(
    buscar,
    customer.name,
    customer.phone,
    customer.email,
    ...customer.accountReferences,
  ));

  return <main className="appPage">
    <header className={styles.pageHeader}>
      <div className={styles.headingCopy}>
        <p className={styles.eyebrow}>Recursos</p>
        <h1 className={styles.title}>Clientes</h1>
        <p className={styles.intro}>Personas y empresas vinculadas a tus financiamientos.</p>
      </div>
      <Link className={styles.primaryAction} href="/clientes/nuevo"><UserPlusIcon aria-hidden="true" />Nuevo cliente</Link>
    </header>

    <div className={styles.toolbar}>
      <form className={styles.searchForm} action="/clientes" role="search">
        <MagnifyingGlassIcon aria-hidden="true" />
        <input name="buscar" defaultValue={buscar} placeholder="Buscar por nombre, contacto o lote…" aria-label="Buscar clientes" />
      </form>
      <span className={styles.resultCount}>{customers.length} {customers.length === 1 ? "cliente" : "clientes"}</span>
    </div>

    {customers.length > 0 ? <section className={styles.tableCard} aria-label="Lista de clientes">
      <table className={styles.table}>
        <thead><tr><th>Cliente</th><th>Contacto</th><th>Financiamientos</th><th>Última actividad</th><th><span className="srOnly">Acciones</span></th></tr></thead>
        <tbody>{customers.map((customer) => <tr key={customer.id}>
          <td data-label="Cliente"><div className={styles.primaryCell}><Link href={`/clientes/${customer.id}`}>{customer.name}</Link><span>{customer.accountReferences.length > 0 ? `Lotes ${customer.accountReferences.join(", ")}` : "Sin financiamientos"}</span></div></td>
          <td data-label="Contacto"><div className={styles.primaryCell}><strong>{customer.phone || "Sin teléfono"}</strong><span>{customer.email || "Sin correo"}</span></div></td>
          <td data-label="Financiamientos"><span className={customer.financingCount > 0 ? styles.statusBadge : styles.mutedValue}>{customer.financingCount} {customer.financingCount === 1 ? "activo" : "activos"}</span></td>
          <td data-label="Última actividad">{formatDate(customer.latestActivityAt)}</td>
          <td data-label="Acciones"><div className={styles.actions}>
            <Link className={`${styles.rowAction} ${styles.actionIconOnly}`} href={`/clientes/${customer.id}`} aria-label={`Ver ${customer.name}`} title="Ver cliente"><EyeIcon aria-hidden="true" /><span className={styles.actionLabel}>Ver</span></Link>
            <Link className={`${styles.rowAction} ${styles.actionIconOnly}`} href={`/clientes/${customer.id}/editar`} aria-label={`Editar ${customer.name}`} title="Editar cliente"><PencilSquareIcon aria-hidden="true" /><span className={styles.actionLabel}>Editar</span></Link>
          </div></td>
        </tr>)}</tbody>
      </table>
    </section> : <section className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true"><UserGroupIcon /></span>
      <h2>{buscar ? "No encontramos clientes" : "Agrega tu primer cliente"}</h2>
      <p>{buscar ? "Prueba con otro nombre, teléfono, correo o lote." : "Los clientes se crean por separado y luego se vinculan a sus financiamientos."}</p>
      {!buscar && <Link className={styles.primaryAction} href="/clientes/nuevo">Nuevo cliente</Link>}
    </section>}
  </main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
