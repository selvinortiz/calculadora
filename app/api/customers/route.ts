import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return jsonError("Solicitud no permitida.", 403);
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("El servicio no está disponible.", 503);
  if (!session) return jsonError("Inicia sesión nuevamente.", 401);
  const fields = await readFields(request);
  if ("error" in fields) return jsonError(fields.error!, 400);
  const { data, error } = await supabase.from("customers").insert({ organization_id: session.organizationId, created_by: session.userId, name: fields.name, phone: fields.phone, email: fields.email }).select("id").single();
  if (error || !data) return jsonError("No fue posible guardar el cliente.", 503);
  await supabase.rpc("record_audit_event", { target_organization_id: session.organizationId, target_action: "customer.created", target_entity_type: "customer", target_entity_id: data.id, target_details: {} });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

export async function readFields(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return { error: "Datos inválidos." } as const; }
  if (!isRecord(body)) return { error: "Datos inválidos." } as const;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!name || name.length > 120 || phone.length > 40 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Revisa los datos del cliente." } as const;
  return { name, phone, email };
}
function jsonError(message: string, status: number) { return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } }); }
function isSameOrigin(request: NextRequest) { const origin = request.headers.get("origin"); return !origin || origin === request.nextUrl.origin; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
