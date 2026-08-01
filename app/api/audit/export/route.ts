import { NextResponse } from "next/server";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getCurrentPortalSession();
  if (!session) return NextResponse.json({ message: "Inicia sesión nuevamente." }, { status: 401 });
  if (session.role !== "owner") return NextResponse.json({ message: "Solo el propietario puede exportar la auditoría." }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ message: "El servicio no está disponible." }, { status: 503 });
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,action,entity_type,entity_id,details,created_at,profiles!audit_events_actor_id_fkey(display_name)")
    .eq("organization_id", session.organizationId)
    .order("created_at", { ascending: false })
    .limit(10_000);
  if (error) return NextResponse.json({ message: "No fue posible exportar la auditoría." }, { status: 503 });
  const rows = [
    ["id", "fecha", "accion", "responsable", "tipo_entidad", "entidad", "detalle"],
    ...(data || []).map((event) => {
      const profileValue = event.profiles as unknown;
      const profile = (Array.isArray(profileValue) ? profileValue[0] : profileValue) as { display_name?: string } | null;
      return [String(event.id), event.created_at, event.action, profile?.display_name || "Usuario", event.entity_type, event.entity_id, JSON.stringify(event.details)];
    }),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  return new NextResponse(csv, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function csvCell(value: string) {
  const spreadsheetSafe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}
