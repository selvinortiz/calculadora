import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrganizationSettings } from "@/components/organization-settings";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  if (session.role !== "owner") redirect("/");
  return <main className="appPage">
    <header className="pageHeader"><p className="pageEyebrow">Administración</p><h1 className="pageTitle">Configuración</h1><p className="pageIntro">Datos de la organización y numeración de documentos.</p></header>
    <OrganizationSettings company={session.company} recipient={session.defaultRecipient} />
  </main>;
}
