import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "@/components/resource-pages.module.css";

export default async function AuditPage() {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  if (session.role !== "owner") redirect("/");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("unavailable");
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,action,entity_type,entity_id,details,created_at,profiles!audit_events_actor_id_fkey(display_name)")
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return <main className="appPage">
    <header className={styles.pageHeader}>
      <div className={styles.headingCopy}>
        <p className={styles.eyebrow}>Administración</p>
        <h1 className={styles.title}>Auditoría</h1>
        <p className={styles.intro}>Últimos 200 cambios y operaciones registrados.</p>
      </div>
      <Link className={styles.primaryAction} href="/api/audit/export"><ArrowDownTrayIcon aria-hidden="true" />Exportar CSV</Link>
    </header>
    <section className={styles.tableCard} aria-label="Eventos de auditoría">
      <table className={styles.table}>
        <thead><tr><th>Fecha</th><th>Acción</th><th>Responsable</th><th>Entidad</th><th>Detalle</th></tr></thead>
        <tbody>{(data || []).length === 0 ? <tr><td colSpan={5}>Todavía no hay eventos registrados.</td></tr> : (data || []).map((event) => {
          const profileValue = event.profiles as unknown;
          const profile = (Array.isArray(profileValue) ? profileValue[0] : profileValue) as { display_name?: string } | null;
          return <tr key={event.id}>
            <td data-label="Fecha">{formatDate(event.created_at)}</td>
            <td data-label="Acción"><strong>{event.action}</strong></td>
            <td data-label="Responsable">{profile?.display_name || "Usuario"}</td>
            <td data-label="Entidad">{event.entity_type} · {event.entity_id}</td>
            <td data-label="Detalle"><code>{summarize(event.details)}</code></td>
          </tr>;
        })}</tbody>
      </table>
    </section>
  </main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function summarize(value: unknown) {
  const text = JSON.stringify(value);
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}
