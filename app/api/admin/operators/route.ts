import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateTemporaryPassphrase, requireOwnerContext } from "@/lib/account-administration";
import type { Json } from "@/lib/database.types";

export async function GET() {
  const context = await requireOwnerContext();
  if ("error" in context) return contextError(context.error!);

  const { data: memberships, error } = await context.admin
    .from("organization_members")
    .select("user_id,role,active,created_at,profiles(display_name,must_change_password)")
    .eq("organization_id", context.organizationId)
    .order("created_at");
  if (error) return jsonError("No fue posible cargar los accesos.", 503);

  const { data: authData, error: authError } = await context.admin.auth.admin.listUsers({ perPage: 1000 });
  if (authError) return jsonError("No fue posible cargar los correos.", 503);
  const emails = new Map(authData.users.map((user) => [user.id, user.email || ""]));

  return NextResponse.json({
    operators: (memberships || []).map((membership) => {
      const profileValue = membership.profiles as unknown;
      const profile = Array.isArray(profileValue) ? profileValue[0] : profileValue;
      const normalized = profile as { display_name?: string; must_change_password?: boolean } | null;
      return {
        userId: membership.user_id,
        email: emails.get(membership.user_id) || "",
        displayName: normalized?.display_name || "",
        role: membership.role,
        active: membership.active,
        mustChangePassword: normalized?.must_change_password ?? true,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const context = await requireOwnerContext();
  if ("error" in context) return contextError(context.error!);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Datos inválidos.", 400); }
  if (!isRecord(body)) return jsonError("Datos inválidos.", 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 1 || displayName.length > 80) {
    return jsonError("Revisa el nombre y el correo.", 400);
  }

  const temporaryPassword = generateTemporaryPassphrase();
  const { data: created, error: createError } = await context.admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError || !created.user) return jsonError("No fue posible crear el acceso. El correo puede estar en uso.", 409);

  const { error: profileError } = await context.admin.from("profiles").insert({
    id: created.user.id,
    display_name: displayName,
    must_change_password: true,
  });
  const { error: membershipError } = profileError ? { error: profileError } : await context.admin
    .from("organization_members")
    .insert({ organization_id: context.organizationId, user_id: created.user.id, role: "operator", active: true });
  if (profileError || membershipError) {
    console.error("Operator provisioning database write failed.", profileError || membershipError);
    await context.admin.auth.admin.deleteUser(created.user.id);
    return jsonError("No fue posible completar el acceso.", 503);
  }

  await audit(context, "access.operator_created", created.user.id, { email });
  return NextResponse.json({ ok: true, temporaryPassword, userId: created.user.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function audit(context: Awaited<ReturnType<typeof requireOwnerContext>> & { organizationId: string }, action: string, id: string, details: Record<string, Json | undefined>) {
  if (!("supabase" in context)) return;
  await context.supabase.rpc("record_audit_event", {
    target_organization_id: context.organizationId,
    target_action: action,
    target_entity_type: "profile",
    target_entity_id: id,
    target_details: details,
  });
}
function contextError(error: "unavailable" | "unauthorized" | "forbidden") {
  if (error === "unavailable") return jsonError("El servicio no está disponible.", 503);
  if (error === "unauthorized") return jsonError("Inicia sesión nuevamente.", 401);
  return jsonError("Solo el propietario puede administrar accesos.", 403);
}
function jsonError(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }); }
function isSameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === request.nextUrl.origin; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
