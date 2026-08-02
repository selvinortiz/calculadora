import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/mutation-response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearPortalSessionCache } from "@/lib/current-portal-session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return jsonError("El servicio no está disponible.", 503);

  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";
  if (claimsError || !userId) return jsonError("Inicia sesión nuevamente.", 401);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Contraseña inválida.", 400); }
  const password = isRecord(body) && typeof body.password === "string" ? body.password : "";
  if (!isStrongEnough(password)) {
    return jsonError("Usa al menos 12 caracteres, con letras y números.", 400);
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) return jsonError("No fue posible cambiar la contraseña.", 400);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (profileError) return jsonError("La contraseña cambió, pero no pudimos completar el acceso.", 503);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (membership) {
    const { error: auditError } = await admin.rpc("server_record_audit_event", {
      actor_id: userId,
      target_organization_id: membership.organization_id,
      target_action: "access.password_changed",
      target_entity_type: "profile",
      target_entity_id: userId,
      target_details: {},
    });
    if (auditError) return jsonError("La contraseña cambió, pero no pudimos registrar la auditoría.", 503);
  }

  clearPortalSessionCache(userId);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

function isStrongEnough(value: string) {
  return value.length >= 12 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}
