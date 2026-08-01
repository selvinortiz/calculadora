import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOrigin, isUuid } from "@/lib/mutation-response";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ customerId: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return jsonError("El servicio no está disponible.", 503);
  if (!session) return jsonError("Inicia sesión nuevamente.", 401);
  const { customerId } = await params;
  if (!isUuid(customerId)) return jsonError("El cliente no es válido.", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Datos inválidos.", 400); }
  if (!isRecord(body)) return jsonError("Datos inválidos.", 400);
  const archive = body.archive === true;
  let name: string | null = null;
  let phone: string | null = null;
  let email: string | null = null;
  if (!archive) {
    name = typeof body.name === "string" ? body.name.trim() : "";
    phone = typeof body.phone === "string" ? body.phone.trim() : "";
    email = typeof body.email === "string" ? body.email.trim() : "";
    if (!name || name.length > 120 || phone.length > 40 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return jsonError("Revisa los datos del cliente.", 400);
  }
  const { error } = await admin.rpc("server_update_customer", {
    actor_id: session.userId,
    target_organization_id: session.organizationId,
    target_customer_id: customerId,
    target_archive: archive,
    target_name: name ?? undefined,
    target_phone: phone ?? undefined,
    target_email: email ?? undefined,
  });
  if (error?.message.includes("active_loans_prevent_customer_archive")) return jsonError("No puedes archivar un cliente con financiamientos activos.", 409);
  if (error?.message.includes("customer_not_found")) return jsonError("El cliente ya no existe.", 404);
  if (error) return jsonError("No fue posible actualizar el cliente.", 503);
  return NextResponse.json({ ok: true });
}
function jsonError(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
