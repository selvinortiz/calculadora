import type { Metadata } from "next";
import { PersistenceDirectory } from "@/components/persistence-directory";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export const metadata: Metadata = {
  title: "Directorio",
  description:
    "Guarda organizaciones, clientes y financiamientos para completar cálculos y documentos.",
};

export default async function DirectoryPage() {
  const session = await getCurrentPortalSession();

  return (
    <main className="appPage">
      <header className="pageHeader">
        <p className="pageEyebrow">Datos guardados</p>
        <h1 className="pageTitle">Directorio</h1>
        <p className="pageIntro">
          Reutiliza los datos de clientes y financiamientos en tus documentos.
        </p>
      </header>
      <PersistenceDirectory
        operatorCompany={session?.company ?? ""}
        operatorName={session?.name ?? ""}
        storageScope={session?.email ?? "demo@creditos.local"}
      />
    </main>
  );
}
