import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateTemporaryPassphrase, requireOwnerContext } from "@/lib/account-administration";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const context = await requireOwnerContext();
  if ("error" in context) return jsonError(context.error === "forbidden" ? "Solo el propietario puede administrar accesos." : "El servicio no está disponible.", context.error === "forbidden" ? 403 : context.error === "unauthorized" ? 401 : 503);
  const { userId } = await params;
  if (userId === context.user.id) return jsonError("No puedes modificar tu propio acceso aquí.", 400);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Datos inválidos.", 400); }
  const action = isRecord(body) && typeof body.action === "string" ? body.action : "";
  const { data: membership } = await context.admin.from("organization_members").select("role,active").eq("organization_id", context.organizationId).eq("user_id", userId).maybeSingle();
  if (!membership || membership.role !== "operator") return jsonError("Operador no encontrado.", 404);

  if (action === "deactivate" || action === "reactivate") {
    const active = action === "reactivate";
    const { error } = await context.admin.from("organization_members").update({ active, updated_at: new Date().toISOString() }).eq("organization_id", context.organizationId).eq("user_id", userId);
    if (error) return jsonError("No fue posible actualizar el acceso.", 503);
    await context.supabase.rpc("record_audit_event", {
      target_organization_id: context.organizationId,
      target_action: `access.operator_${active ? "reactivated" : "deactivated"}`,
      target_entity_type: "profile",
      target_entity_id: userId,
      target_details: {},
    });
    return NextResponse.json({ ok: true, active });
  }

  if (action === "reset_password") {
    const temporaryPassword = generateTemporaryPassphrase();
    const { error: passwordError } = await context.admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
    if (passwordError) return jsonError("No fue posible restablecer la contraseña.", 503);
    const { error: profileError } = await context.admin.from("profiles").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", userId);
    if (profileError) return jsonError("La contraseña cambió, pero no pudimos completar el restablecimiento.", 503);
    await context.supabase.rpc("record_audit_event", {
      target_organization_id: context.organizationId,
      target_action: "access.password_reset",
      target_entity_type: "profile",
      target_entity_id: userId,
      target_details: {},
    });
    return NextResponse.json({ ok: true, temporaryPassword }, { headers: { "Cache-Control": "no-store" } });
  }

  return jsonError("Acción inválida.", 400);
}

function jsonError(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }); }
function isSameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === request.nextUrl.origin; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
