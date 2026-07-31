import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoanCalculator } from "@/components/loan-calculator";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { loadResourceDirectory } from "@/lib/resource-data";
import styles from "@/components/resource-pages.module.css";

export const metadata: Metadata = { title: "Nuevo financiamiento" };

export default async function NewFinancingPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  const [{ cliente }, directory] = await Promise.all([searchParams, loadResourceDirectory(session)]);
  const initialCustomer = directory.customers.find((customer) => customer.id === cliente);
  return <main className="appPage">
    <nav className={styles.breadcrumbs} aria-label="Migas de pan"><Link href="/financiamientos">Financiamientos</Link><span>/</span><span>Nuevo</span></nav>
    <header className="pageHeader"><p className="pageEyebrow">Financiamientos</p><h1 className="pageTitle">Nuevo financiamiento</h1></header>
    <LoanCalculator operatorCompany={session.company} storageScope={session.email} initialCustomer={initialCustomer ? { id: initialCustomer.id, name: initialCustomer.name } : undefined} />
  </main>;
}
