import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerForm } from "@/components/customer-form";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import styles from "@/components/resource-pages.module.css";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewCustomerPage() {
  if (!await getCurrentPortalSession()) redirect("/acceso");
  return <main className="appPage">
    <nav className={styles.breadcrumbs} aria-label="Migas de pan"><Link href="/clientes">Clientes</Link><span>/</span><span>Nuevo</span></nav>
    <header className={styles.pageHeader}>
      <div className={styles.headingCopy}><p className={styles.eyebrow}>Clientes</p><h1 className={styles.title}>Nuevo cliente</h1><p className={styles.intro}>Guarda sus datos para vincularlos a uno o más financiamientos.</p></div>
    </header>
    <CustomerForm />
  </main>;
}
