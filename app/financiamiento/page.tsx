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
        <h1 className="pageTitle">Calcular un préstamo</h1>
        <p className="pageIntro">
          Ingresa las condiciones del préstamo para calcular la cuota mensual, el
          interés y el total a pagar.
        </p>
      </header>
      <LoanCalculator operatorCompany={session?.company ?? ""} />
    </main>
  );
}
