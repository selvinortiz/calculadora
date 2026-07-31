import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Ingresa tu correo y contraseña.", 400);
  }
  if (!isRecord(body)) return jsonError("Ingresa tu correo y contraseña.", 400);

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || email.length > 254 || password.length < 8 || password.length > 128) {
    return jsonError("Ingresa tu correo y contraseña.", 400);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return jsonError("El servicio no está disponible.", 503);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return jsonError("Correo o contraseña incorrectos.", 401);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("active")
    .eq("user_id", data.user.id)
    .eq("active", true)
    .maybeSingle();
  if (!membership) {
    await supabase.auth.signOut();
    return jsonError("Este acceso está desactivado. Solicita ayuda al propietario.", 403);
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
