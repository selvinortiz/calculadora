import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerForm } from "@/components/customer-form";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { loadResourceDirectory } from "@/lib/resource-data";
import styles from "@/components/resource-pages.module.css";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  const [{ customerId }, directory] = await Promise.all([params, loadResourceDirectory(session)]);
  const customer = directory.customers.find((item) => item.id === customerId);
  if (!customer) notFound();
  return <main className="appPage">
    <nav className={styles.breadcrumbs} aria-label="Migas de pan"><Link href="/clientes">Clientes</Link><span>/</span><Link href={`/clientes/${customer.id}`}>{customer.name}</Link><span>/</span><span>Editar</span></nav>
    <header className={styles.pageHeader}><div className={styles.headingCopy}><p className={styles.eyebrow}>Cliente</p><h1 className={styles.title}>Editar cliente</h1><p className={styles.intro}>Actualiza la información de contacto de {customer.name}.</p></div></header>
    <CustomerForm customerId={customer.id} initial={{ name: customer.name, phone: customer.phone, email: customer.email }} />
  </main>;
}
