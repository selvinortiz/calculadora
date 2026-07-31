import type { Metadata } from "next";
import { PaymentAdjustmentWorkflow } from "@/components/payment-adjustment-workflow";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export const metadata: Metadata = {
  title: "Ajustar un pago",
  description:
    "Aplica un saldo a favor a la siguiente cuota y prepara una constancia imprimible.",
};

export default async function PaymentAdjustmentPage() {
  const session = await getCurrentPortalSession();

  return (
    <main className="appPage">
      <header className="pageHeader">
        <h1 className="pageTitle">Ajuste de pago</h1>
      </header>
      <PaymentAdjustmentWorkflow
        operatorCompany={session?.company ?? ""}
        operatorName={session?.name ?? ""}
        storageScope={session?.email ?? "demo@creditos.local"}
      />
    </main>
  );
}
