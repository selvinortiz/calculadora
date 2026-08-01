import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { calculatePaymentSchedule, calculateSimpleInterestQuote, validateLoanInputs } from "@/lib/finance";
import { CALCULATION_VERSION, DOCUMENT_SNAPSHOT_VERSION, moneyToCents, normalizeAnnualRate, persistSchedule, type MutationResult, type PostLoanCommand, type PostedTransaction } from "@/lib/domain";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { isIsoDate, isRecord, isSameOrigin, isUuid, mapDatabaseMutationError, mutationError } from "@/lib/mutation-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return mutationError("forbidden", "Solicitud no permitida.");
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return mutationError("unavailable", "El servicio no está disponible.");
  if (!session) return mutationError("unauthorized", "Inicia sesión nuevamente.");
  let body: unknown;
  try { body = await request.json(); } catch { return mutationError("validation", "Datos inválidos."); }
  if (!isRecord(body) || !isUuid(body.idempotencyKey) || !isUuid(body.customerId)) return mutationError("validation", "Faltan los identificadores del registro.");
  if (body.replacesTransactionId && session.role !== "owner") return mutationError("forbidden", "Solo el propietario puede registrar reemplazos.");

  const price = Number(body.price), downPayment = Number(body.downPayment), annualRate = Number(body.annualRate), termMonths = Number(body.termMonths);
  const accountReference = typeof body.accountReference === "string" ? body.accountReference.trim() : "";
  const firstDueDate = body.firstDueDate, issueDate = body.issueDate;
  if (Object.keys(validateLoanInputs({ price, downPayment, annualRate })).length || !Number.isInteger(termMonths) || termMonths < 2 || termMonths > 360 || !accountReference || accountReference.length > 80 || !isIsoDate(firstDueDate) || !isIsoDate(issueDate) || firstDueDate <= issueDate) return mutationError("validation", "La primera cuota debe ser posterior a la fecha de emisión.");

  const { data: customer } = await supabase.from("customers").select("id,name").eq("id", body.customerId).eq("organization_id", session.organizationId).is("archived_at", null).maybeSingle();
  if (!customer) return mutationError("validation", "Selecciona un cliente activo del directorio.");
  const replacesTransactionId = await validateReplacement(supabase, body.replacesTransactionId, session.organizationId);
  if (replacesTransactionId === false) return mutationError("validation", "El registro reemplazado debe ser una originación anulada de esta organización.");
  const principal = price - downPayment;
  if (principal <= 0) return mutationError("validation", "El capital financiado debe ser mayor que cero.");
  const quote = calculateSimpleInterestQuote(principal, annualRate, termMonths);
  const schedule = calculatePaymentSchedule({ principal: quote.principal, interestTotal: quote.interestTotal, months: termMonths, firstDueDate });
  const command: PostLoanCommand = {
    idempotencyKey: body.idempotencyKey,
    organizationId: session.organizationId,
    customerId: customer.id,
    accountReference,
    priceCents: moneyToCents(price),
    downPaymentCents: moneyToCents(downPayment),
    principalCents: moneyToCents(principal),
    annualRate: normalizeAnnualRate(annualRate),
    termMonths,
    firstDueDate,
    issueDate,
    schedule: persistSchedule(schedule),
    snapshot: {
      version: DOCUMENT_SNAPSHOT_VERSION,
      calculationVersion: CALCULATION_VERSION,
      documentKind: "payment_schedule",
      issuedAt: `${issueDate}T00:00:00.000Z`,
      organizationName: session.company,
      customerName: customer.name,
      accountReference,
      payload: { price, downPayment, principal: quote.principal, annualRate: normalizeAnnualRate(annualRate), termMonths, firstDueDate, issueDate, quote, schedule, notice: "Las cuotas ordinarias se administran por separado." },
    },
    ...(replacesTransactionId ? { replacesTransactionId } : {}),
  };
  const { data, error } = await admin.rpc("server_post_loan", { actor_id: session.userId, command });
  if (error) return mapDatabaseMutationError(error);
  return NextResponse.json<MutationResult<PostedTransaction>>({ ok: true, data: data as PostedTransaction }, { headers: { "Cache-Control": "no-store" } });
}

async function validateReplacement(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, value: unknown, organizationId: string): Promise<string | null | false> {
  if (value === undefined || value === null || value === "") return null;
  if (!supabase || !isUuid(value)) return false;
  const { data } = await supabase.from("transactions").select("id").eq("id", value).eq("organization_id", organizationId).eq("type", "loan_origination").eq("status", "voided").maybeSingle();
  return data?.id || false;
}
