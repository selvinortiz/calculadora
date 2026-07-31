import type { Metadata } from "next";
import { CapitalPaymentWorkflow } from "@/components/capital-payment-workflow";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export const metadata: Metadata = {
  title: "Abono a capital",
  description:
    "Registra un abono a capital, recalcula la cuota y prepara un comprobante imprimible.",
};

export default async function CapitalPaymentPage({ searchParams }: { searchParams: Promise<{ financiamiento?: string }> }) {
  const session = await getCurrentPortalSession();
  const { financiamiento } = await searchParams;

  return (
    <main className="appPage">
      <header className="pageHeader">
        <h1 className="pageTitle">Abono a capital</h1>
      </header>
      <CapitalPaymentWorkflow
        initialFinancingId={financiamiento}
        operatorCompany={session?.company ?? ""}
        operatorName={session?.name ?? ""}
        storageScope={session?.email ?? "demo@creditos.local"}
      />
    </main>
  );
}
