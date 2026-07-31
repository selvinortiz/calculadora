import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("El servicio no está disponible.", 503);
  if (!session) return jsonError("Inicia sesión nuevamente.", 401);
  const { customerId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Datos inválidos.", 400); }
  if (!isRecord(body)) return jsonError("Datos inválidos.", 400);
  const archive = body.archive === true;
  const updates: { updated_at: string; archived_at?: string; name?: string; phone?: string; email?: string } = { updated_at: new Date().toISOString() };
  if (archive) updates.archived_at = new Date().toISOString();
  else {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!name || name.length > 120 || phone.length > 40 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return jsonError("Revisa los datos del cliente.", 400);
    Object.assign(updates, { name, phone, email });
  }
  const { error } = await supabase.from("customers").update(updates).eq("id", customerId).eq("organization_id", session.organizationId);
  if (error) return jsonError("No fue posible actualizar el cliente.", 503);
  await supabase.rpc("record_audit_event", { target_organization_id: session.organizationId, target_action: archive ? "customer.archived" : "customer.updated", target_entity_type: "customer", target_entity_id: customerId, target_details: {} });
  return NextResponse.json({ ok: true });
}
function jsonError(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }); }
function isSameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === request.nextUrl.origin; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
