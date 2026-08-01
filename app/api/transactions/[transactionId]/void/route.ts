import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { isRecord, isSameOrigin, isUuid, mapDatabaseMutationError, mutationError } from "@/lib/mutation-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ transactionId: string }> }) {
  if (!isSameOrigin(request)) return mutationError("forbidden", "Solicitud no permitida.");
  const session = await getCurrentPortalSession(); const supabase = await createSupabaseServerClient(); const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return mutationError("unavailable", "El servicio no está disponible.");
  if (!session) return mutationError("unauthorized", "Inicia sesión nuevamente.");
  if (session.role !== "owner") return mutationError("forbidden", "Solo el propietario puede anular registros.");
  const { transactionId } = await params;
  let body: unknown; try { body = await request.json(); } catch { return mutationError("validation", "Indica el motivo de la anulación."); }
  const reason = isRecord(body) && typeof body.reason === "string" ? body.reason.trim() : "";
  if (!isUuid(transactionId) || !reason || reason.length > 500) return mutationError("validation", "Indica un motivo válido.");
  const { data, error } = await admin.rpc("server_void_transaction", { actor_id: session.userId, target_transaction_id: transactionId, reason });
  if (error) return mapDatabaseMutationError(error);
  return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
}
