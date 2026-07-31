import { NextResponse } from "next/server";
import type { MutationErrorCode, MutationResult } from "./domain";

export function mutationError(code: MutationErrorCode, message: string) {
  const status = { validation: 400, unauthorized: 401, forbidden: 403, duplicate: 409, conflict: 409, unavailable: 503 }[code];
  return NextResponse.json<MutationResult<never>>({ ok: false, code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function mapDatabaseMutationError(error: { message: string; code?: string | null }) {
  const message = error.message || "database_error";
  if (message.includes("loan_version_conflict")) return mutationError("conflict", "El financiamiento cambió en otra sesión. Recarga los datos e intenta de nuevo.");
  if (message.includes("dependent_transactions_must_be_voided_first") || message.includes("loan_transactions_must_be_voided_first")) return mutationError("conflict", "Anula primero las operaciones posteriores, en orden inverso.");
  if (message.includes("duplicate") || error.code === "23505") return mutationError("duplicate", "Ya existe un registro con esos datos.");
  if (error.code === "42501" || message.includes("required")) return mutationError("forbidden", "No tienes permiso para realizar esta operación.");
  if (message.includes("not_found")) return mutationError("validation", "El financiamiento ya no está activo.");
  return mutationError("unavailable", "No fue posible completar la operación.");
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(value);
}
