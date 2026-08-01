import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessAdmin } from "./access-admin";
import { getCurrentPortalSession } from "@/lib/current-portal-session";

export const metadata: Metadata = { title: "Accesos" };

export default async function AccessAdministrationPage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  if (session.role !== "owner") redirect("/");

  return (
    <main className="appPage">
      <AccessAdmin />
    </main>
  );
}
