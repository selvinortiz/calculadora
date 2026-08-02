import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownTrayIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import resourceStyles from "@/components/resource-pages.module.css";
import styles from "./page.module.css";

type AuditEvent = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  details: unknown;
  created_at: string;
  profiles: unknown;
};

const CATEGORIES = [
  { value: "", label: "Todas las actividades" },
  { value: "financing", label: "Financiamientos" },
  { value: "customer", label: "Clientes" },
  { value: "access", label: "Accesos y perfil" },
  { value: "settings", label: "Configuración" },
] as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ buscar?: string; tipo?: string }> }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  if (session.role !== "owner") redirect("/");
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("unavailable");
  const [{ buscar = "", tipo = "" }, { data, error }] = await Promise.all([
    searchParams,
    supabase
      .from("audit_events")
      .select("id,action,entity_type,entity_id,details,created_at,profiles!audit_events_actor_id_fkey(display_name)")
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (error) throw new Error(error.message);

  const query = buscar.trim().toLocaleLowerCase("es-GT");
  const events = ((data || []) as AuditEvent[]).map(presentEvent).filter((event) => {
    const matchesCategory = !tipo || event.category === tipo;
    const searchable = `${event.actionLabel} ${event.actor} ${event.entityLabel} ${event.summary}`.toLocaleLowerCase("es-GT");
    return matchesCategory && (!query || searchable.includes(query));
  });

  return <main className="appPage">
    <header className={resourceStyles.pageHeader}>
      <div className={resourceStyles.headingCopy}>
        <p className={resourceStyles.eyebrow}>Administración</p>
        <h1 className={resourceStyles.title}>Auditoría</h1>
        <p className={resourceStyles.intro}>Actividad reciente explicada en lenguaje claro. Se muestran hasta 200 eventos.</p>
      </div>
      <Link className={resourceStyles.primaryAction} href="/api/audit/export"><ArrowDownTrayIcon aria-hidden="true" />Exportar CSV</Link>
    </header>

    <form className={styles.filters} role="search">
      <label className={styles.searchField}>
        <span className="srOnly">Buscar actividad</span>
        <MagnifyingGlassIcon aria-hidden="true" />
        <input name="buscar" defaultValue={buscar} placeholder="Buscar por acción, responsable o documento…" />
      </label>
      <label className={styles.categoryField}>
        <span className="srOnly">Filtrar por tipo</span>
        <select name="tipo" defaultValue={tipo}>
          {CATEGORIES.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}
        </select>
      </label>
      <button type="submit">Aplicar filtros</button>
      {(buscar || tipo) && <Link href="/configuracion/auditoria">Limpiar</Link>}
      <output className={styles.resultCount} aria-live="polite">{events.length} {events.length === 1 ? "evento" : "eventos"}</output>
    </form>

    {events.length > 0 ? <section className={resourceStyles.tableCard} aria-label="Eventos de auditoría">
      <table className={resourceStyles.table}>
        <thead><tr><th>Fecha</th><th>Actividad</th><th>Responsable</th><th>Registro</th><th>Detalle</th></tr></thead>
        <tbody>{events.map((event) => <tr key={event.id}>
          <td data-label="Fecha"><time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></td>
          <td data-label="Actividad"><strong className={styles.actionName}>{event.actionLabel}</strong></td>
          <td data-label="Responsable">{event.actor}</td>
          <td data-label="Registro">{event.href ? <Link className={styles.entityLink} href={event.href}>{event.entityLabel}</Link> : event.entityLabel}</td>
          <td data-label="Detalle"><span className={styles.summary}>{event.summary}</span></td>
        </tr>)}</tbody>
      </table>
    </section> : <section className={resourceStyles.emptyState}>
      <h2>{buscar || tipo ? "No encontramos actividad" : "Todavía no hay actividad"}</h2>
      <p>{buscar || tipo ? "Prueba con otros filtros o limpia la búsqueda." : "Los cambios y operaciones aparecerán aquí cuando se registren."}</p>
      {(buscar || tipo) && <Link className={resourceStyles.secondaryAction} href="/configuracion/auditoria">Limpiar filtros</Link>}
    </section>}
  </main>;
}

function presentEvent(event: AuditEvent) {
  const details = asRecord(event.details);
  const profileValue = event.profiles;
  const profile = (Array.isArray(profileValue) ? profileValue[0] : profileValue) as { display_name?: string } | null;
  const documentNumber = text(details.documentNumber);
  const loanId = text(details.loanId) || (event.entity_type === "loan" ? event.entity_id : "");
  const customerName = text(details.name) || text(asRecord(details.after).name) || text(asRecord(details.before).name);
  return {
    id: event.id,
    actionLabel: actionLabel(event.action),
    actor: profile?.display_name || "Usuario",
    category: category(event.action),
    createdAt: event.created_at,
    entityLabel: documentNumber || customerName || entityLabel(event.entity_type),
    href: loanId ? `/financiamientos/${loanId}` : event.entity_type === "customer" ? `/clientes/${event.entity_id}` : "",
    summary: detailSummary(event.action, details),
  };
}

function actionLabel(action: string) {
  return ({
    "loan.posted": "Financiamiento registrado",
    "capital_payment.posted": "Abono a capital registrado",
    "payment_adjustment.posted": "Ajuste de pago registrado",
    "transaction.edited": "Movimiento corregido",
    "transaction.voided": "Movimiento anulado",
    "customer.created": "Cliente creado",
    "customer.updated": "Cliente actualizado",
    "customer.archived": "Cliente archivado",
    "settings.updated": "Configuración actualizada",
    "profile.updated": "Perfil actualizado",
    "access.operator_created": "Acceso creado",
    "access.operator_deactivated": "Acceso desactivado",
    "access.operator_reactivated": "Acceso reactivado",
    "access.email_updated": "Correo de acceso actualizado",
    "access.password_reset": "Contraseña restablecida",
    "access.password_changed": "Contraseña actualizada",
  } as Record<string, string>)[action] || "Actividad registrada";
}

function category(action: string) {
  if (action.startsWith("customer.")) return "customer";
  if (action.startsWith("access.") || action.startsWith("profile.")) return "access";
  if (action.startsWith("settings.")) return "settings";
  return "financing";
}

function entityLabel(type: string) {
  return ({ loan: "Financiamiento", transaction: "Movimiento", customer: "Cliente", profile: "Usuario", organization: "Organización" } as Record<string, string>)[type] || "Registro";
}

function detailSummary(action: string, details: Record<string, unknown>) {
  const documentNumber = text(details.documentNumber);
  if (action === "loan.posted") return documentNumber ? `Se emitió ${documentNumber}.` : "Se creó el plan de pagos inicial.";
  if (action === "capital_payment.posted") return documentNumber ? `Se emitió el recibo ${documentNumber}.` : "Se recalculó el plan después del abono.";
  if (action === "payment_adjustment.posted") return documentNumber ? `Se emitió la constancia ${documentNumber}.` : "Se aplicó el saldo del pago a la cuota siguiente.";
  if (action === "transaction.edited") return documentNumber ? `Se corrigió ${documentNumber} y su documento histórico.` : "Se corrigieron los datos del movimiento.";
  if (action === "transaction.voided") return text(details.reason) ? `Motivo: ${text(details.reason)}` : "El movimiento dejó de formar parte del plan vigente.";
  if (action === "customer.created") return text(details.name) ? `Se agregó a ${text(details.name)}.` : "Se agregó un cliente.";
  if (action === "customer.updated") return "Se actualizaron los datos de contacto del cliente.";
  if (action === "customer.archived") return "El cliente se retiró del directorio activo.";
  if (action === "settings.updated") return "Se actualizaron los datos de la organización o la numeración de documentos.";
  if (action === "profile.updated") return "Se actualizaron los datos del perfil.";
  if (action === "access.operator_created") return text(details.email) ? `Se habilitó el acceso para ${text(details.email)}.` : "Se habilitó un nuevo acceso.";
  if (action === "access.email_updated") return text(details.email) ? `Nuevo correo: ${text(details.email)}.` : "Se cambió el correo usado para ingresar.";
  if (action === "access.operator_deactivated") return "El usuario ya no puede ingresar.";
  if (action === "access.operator_reactivated") return "El usuario puede ingresar nuevamente.";
  if (action === "access.password_reset") return "Se generó una nueva contraseña temporal.";
  if (action === "access.password_changed") return "El usuario estableció una nueva contraseña.";
  return "La operación quedó registrada correctamente.";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
