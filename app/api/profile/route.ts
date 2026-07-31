import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);

  const session = await getCurrentPortalSession();
  if (!session) return jsonError("Inicia sesión nuevamente.", 401);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("El servicio no está disponible.", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Revisa los datos ingresados.", 400);
  }

  if (!isRecord(body) || typeof body.displayName !== "string") {
    return jsonError("Ingresa tu nombre.", 400);
  }

  const displayName = body.displayName.trim();
  if (displayName.length < 1 || displayName.length > 80) {
    return jsonError("El nombre debe tener entre 1 y 80 caracteres.", 400);
  }

  let organizationName: string | null = null;
  if (session.role === "owner") {
    if (typeof body.organizationName !== "string") {
      return jsonError("Ingresa el nombre de la organización.", 400);
    }
    organizationName = body.organizationName.trim();
    if (organizationName.length < 1 || organizationName.length > 100) {
      return jsonError("El nombre de la organización debe tener entre 1 y 100 caracteres.", 400);
    }
  } else if ("organizationName" in body) {
    return jsonError("Solo el propietario puede cambiar la organización.", 403);
  }

  const { data, error } = await supabase.rpc("update_my_profile", organizationName === null
    ? { target_display_name: displayName }
    : { target_display_name: displayName, target_organization_name: organizationName });

  if (error) {
    if (error.code === "42501") return jsonError("No tienes permiso para guardar este cambio.", 403);
    if (error.code === "22023") return jsonError("Revisa los datos ingresados.", 400);
    return jsonError("No fue posible guardar los cambios.", 503);
  }

  return NextResponse.json({ ok: true, profile: data }, { headers: { "Cache-Control": "no-store" } });
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
