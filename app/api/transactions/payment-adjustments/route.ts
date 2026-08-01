import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { calculatePaymentCreditAdjustment } from "@/lib/finance";
import { CALCULATION_VERSION, DOCUMENT_SNAPSHOT_VERSION, centsToMoney, persistAdjustment, type MutationResult, type PostPaymentAdjustmentCommand, type PostedTransaction } from "@/lib/domain";
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
  if (!isRecord(body) || !isUuid(body.idempotencyKey) || !isUuid(body.loanId)) return mutationError("validation", "Selecciona un financiamiento registrado.");
  if (body.replacesTransactionId && session.role !== "owner") return mutationError("forbidden", "Solo el propietario puede registrar reemplazos.");
  const paymentNumber = Number(body.paymentNumber), expectedLoanVersion = Number(body.expectedLoanVersion), receivedPayment = Number(body.receivedPayment);
  if (!Number.isInteger(paymentNumber) || paymentNumber < 1 || !Number.isInteger(expectedLoanVersion) || !Number.isFinite(receivedPayment) || !isIsoDate(body.paymentDate) || !isIsoDate(body.nextPaymentDate) || body.nextPaymentDate <= body.paymentDate) return mutationError("validation", "La próxima cuota debe ser posterior a la fecha del pago.");
  if (!validText(body.paymentReference, 120) || !validText(body.adjustedBy, 80) || !validText(body.notes, 1000)) return mutationError("validation", "Uno de los textos supera la longitud permitida.");
  const { data: loan } = await supabase.from("loans").select("id,customer_id,account_reference,version,current_schedule_version_id,customers!loans_customer_id_fkey(name)").eq("id", body.loanId).eq("organization_id", session.organizationId).eq("status", "active").maybeSingle();
  if (!loan || !loan.current_schedule_version_id) return mutationError("validation", "El financiamiento ya no está activo.");
  if (loan.version !== expectedLoanVersion) return mutationError("conflict", "El financiamiento cambió en otra sesión. Recarga e intenta de nuevo.");
  const replacesTransactionId = await validateReplacement(supabase, body.replacesTransactionId, session.organizationId, loan.id);
  if (replacesTransactionId === false) return mutationError("validation", "El registro reemplazado debe ser un ajuste anulado de este financiamiento.");
  const { data: installmentRows } = await supabase.from("installments").select("payment_number,payment_cents").eq("schedule_version_id", loan.current_schedule_version_id).in("payment_number", [paymentNumber, paymentNumber + 1]);
  const installment = installmentRows?.find((row) => row.payment_number === paymentNumber);
  const nextInstallment = installmentRows?.find((row) => row.payment_number === paymentNumber + 1);
  if (!installment || !nextInstallment) return mutationError("validation", "La cuota indicada no pertenece al plan vigente o no tiene una cuota siguiente.");
  let adjustment;
  try { adjustment = calculatePaymentCreditAdjustment({ paymentNumber, scheduledPayment: centsToMoney(installment.payment_cents), receivedPayment }); }
  catch { return mutationError("validation", "El pago debe exceder la cuota, pero el saldo a favor debe ser menor que una cuota completa."); }
  const persisted = persistAdjustment(adjustment);
  const customerValue = loan.customers as unknown;
  const customer = (Array.isArray(customerValue) ? customerValue[0] : customerValue) as { name?: string } | null;
  const adjustedBy = text(body.adjustedBy, 80);
  if (!adjustedBy) return mutationError("validation", "Indica quién autoriza el ajuste.");
  const command: PostPaymentAdjustmentCommand = {
    idempotencyKey: body.idempotencyKey, organizationId: session.organizationId, loanId: loan.id, expectedLoanVersion,
    paymentNumber, paymentDate: body.paymentDate, nextPaymentDate: body.nextPaymentDate, ...persisted,
    paymentReference: text(body.paymentReference, 120), adjustedBy, notes: text(body.notes, 1000),
    snapshot: { version: DOCUMENT_SNAPSHOT_VERSION, calculationVersion: CALCULATION_VERSION, documentKind: "payment_adjustment_record", issuedAt: `${body.paymentDate}T00:00:00.000Z`, organizationName: session.company, customerName: customer?.name || "Cliente", accountReference: loan.account_reference, payload: { adjustment, paymentDate: body.paymentDate, nextPaymentDate: body.nextPaymentDate, paymentReference: text(body.paymentReference, 120), adjustedBy, notes: text(body.notes, 1000), notice: "Este ajuste se aplica únicamente a la cuota siguiente." } },
    ...(replacesTransactionId ? { replacesTransactionId } : {}),
  };
  const { data, error } = await admin.rpc("server_post_payment_adjustment", { actor_id: session.userId, command });
  if (error) return mapDatabaseMutationError(error);
  return NextResponse.json<MutationResult<PostedTransaction>>({ ok: true, data: data as PostedTransaction }, { headers: { "Cache-Control": "no-store" } });
}
function text(value: unknown, max: number) { const result = typeof value === "string" ? value.trim() : ""; if (result.length > max) throw new RangeError("text_too_long"); return result; }
function validText(value: unknown, max: number) { return typeof value !== "string" || value.trim().length <= max; }
async function validateReplacement(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, value: unknown, organizationId: string, loanId: string): Promise<string | null | false> {
  if (value === undefined || value === null || value === "") return null;
  if (!isUuid(value)) return false;
  const { data } = await supabase.from("transactions").select("id").eq("id", value).eq("organization_id", organizationId).eq("loan_id", loanId).eq("type", "payment_adjustment").eq("status", "voided").maybeSingle();
  return data?.id || false;
}
