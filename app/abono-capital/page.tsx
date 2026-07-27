import type { Metadata } from "next";
import { CapitalPaymentWorkflow } from "@/components/capital-payment-workflow";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export const metadata: Metadata = {
  title: "Abono a capital",
  description:
    "Registra un abono a capital, recalcula la cuota y prepara un comprobante imprimible.",
};

export default async function CapitalPaymentPage() {
  const session = await getCurrentPortalSession();

  return (
    <main className="appPage">
      <header className="pageHeader">
        <p className="pageEyebrow">Abonos a capital</p>
        <h1 className="pageTitle">Registrar un abono</h1>
        <p className="pageIntro">
          Calcula el nuevo capital, los intereses y la cuota; después prepara el
          comprobante del abono y el plan de pagos actualizado.
        </p>
      </header>
      <CapitalPaymentWorkflow
        operatorCompany={session?.company ?? ""}
        operatorName={session?.name ?? ""}
      />
    </main>
  );
}
