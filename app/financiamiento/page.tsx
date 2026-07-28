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
        <p className="pageEyebrow">Préstamos</p>
        <h1 className="pageTitle">Cotizar préstamo</h1>
        <p className="pageIntro">
          Calcula la cuota y prepara el plan de pagos.
        </p>
      </header>
      <LoanCalculator operatorCompany={session?.company ?? ""} />
    </main>
  );
}
