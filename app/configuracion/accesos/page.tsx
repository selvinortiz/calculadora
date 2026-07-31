import { redirect } from "next/navigation";
import { AccessAdmin } from "./access-admin";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export default async function AccessAdministrationPage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  if (session.role !== "owner") redirect("/");

  return (
    <main className="appPage">
      <header className="pageHeader">
        <h1 className="pageTitle">Accesos</h1>
      </header>
      <AccessAdmin />
    </main>
  );
}
