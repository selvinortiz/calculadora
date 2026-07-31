import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return jsonError("El servicio no está disponible.", 503);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("Inicia sesión nuevamente.", 401);

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
    .eq("id", user.id);
  if (profileError) return jsonError("La contraseña cambió, pero no pudimos completar el acceso.", 503);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (membership) {
    await supabase.rpc("record_audit_event", {
      target_organization_id: membership.organization_id,
      target_action: "access.password_changed",
      target_entity_type: "profile",
      target_entity_id: user.id,
      target_details: {},
    });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

function isStrongEnough(value: string) {
  return value.length >= 12 && value.length <= 128 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}
