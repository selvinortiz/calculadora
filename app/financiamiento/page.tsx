import type { Metadata } from "next";
import { LoanCalculator } from "@/components/loan-calculator";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export const metadata: Metadata = {
  title: "Calcular préstamo",
  description:
    "Calcula capital, interés total y cuota de un financiamiento con interés simple.",
};

export default async function FinancingPage() {
  const session = await getCurrentPortalSession();

  return (
    <main className="appPage">
      <header className="pageHeader">
        <h1 className="pageTitle">Nuevo préstamo</h1>
      </header>
      <LoanCalculator
        operatorCompany={session?.company ?? ""}
        storageScope={session?.email ?? "demo@creditos.local"}
      />
    </main>
  );
}
