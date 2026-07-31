import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import { calculatePaymentSchedule, calculateSimpleInterestQuote } from "@/lib/finance";
import { CALCULATION_VERSION, DOCUMENT_SNAPSHOT_VERSION, centsToMoney, moneyToCents, persistSchedule, type MutationResult, type PostCapitalPaymentCommand, type PostedTransaction } from "@/lib/domain";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { isIsoDate, isRecord, isSameOrigin, isUuid, mapDatabaseMutationError, mutationError } from "@/lib/mutation-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return mutationError("forbidden", "Solicitud no permitida.");
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return mutationError("unavailable", "El servicio no está disponible.");
  if (!session) return mutationError("unauthorized", "Inicia sesión nuevamente.");
  let body: unknown;
  try { body = await request.json(); } catch { return mutationError("validation", "Datos inválidos."); }
  if (!isRecord(body) || !isUuid(body.idempotencyKey) || !isUuid(body.loanId)) return mutationError("validation", "Selecciona un financiamiento registrado.");
  if (body.replacesTransactionId && session.role !== "owner") return mutationError("forbidden", "Solo el propietario puede registrar reemplazos.");
  const paymentNumber = Number(body.paymentNumber), expectedLoanVersion = Number(body.expectedLoanVersion), capitalPayment = Number(body.capitalPayment);
  const transactionMode = body.transactionMode === "combined" ? "combined" : body.transactionMode === "standalone" ? "standalone" : null;
  const balanceSource = body.balanceSource === "statement" ? "statement" : body.balanceSource === "calculated" ? "calculated" : null;
  if (!Number.isInteger(paymentNumber) || paymentNumber < 1 || !Number.isInteger(expectedLoanVersion) || !Number.isFinite(capitalPayment) || capitalPayment <= 0 || !transactionMode || !balanceSource || !isIsoDate(body.transactionDate) || !isIsoDate(body.nextPaymentDate) || (body.lastPaymentDate !== null && !isIsoDate(body.lastPaymentDate))) return mutationError("validation", "Revisa los datos del abono.");

  const { data: loan } = await supabase.from("loans").select("id,customer_id,account_reference,annual_rate,version,current_schedule_version_id,customers!loans_customer_id_fkey(name)").eq("id", body.loanId).eq("organization_id", session.organizationId).eq("status", "active").maybeSingle();
  if (!loan || !loan.current_schedule_version_id) return mutationError("validation", "El financiamiento ya no está activo.");
  if (loan.version !== expectedLoanVersion) return mutationError("conflict", "El financiamiento cambió en otra sesión. Recarga e intenta de nuevo.");
  const replacesTransactionId = await validateReplacement(supabase, body.replacesTransactionId, session.organizationId, loan.id);
  if (replacesTransactionId === false) return mutationError("validation", "El registro reemplazado debe ser un abono anulado de este financiamiento.");
  const { data: schedule } = await supabase.from("schedule_versions").select("id,principal_cents,remaining_months,regular_payment_cents,first_payment_number").eq("id", loan.current_schedule_version_id).eq("status", "active").maybeSingle();
  const { data: installments } = await supabase.from("installments").select("payment_number,payment_cents,interest_cents,remaining_principal_cents").eq("schedule_version_id", loan.current_schedule_version_id).order("payment_number");
  const appliedRow = installments?.find((row) => row.payment_number === paymentNumber);
  const futureRows = installments?.filter((row) => row.payment_number > paymentNumber) || [];
  if (!schedule || !appliedRow || futureRows.length === 0) return mutationError("validation", "La cuota indicada no pertenece al plan vigente o no deja cuotas futuras.");

  const statementCapital = Number(body.statementCapital);
  const currentCapital = balanceSource === "statement" ? statementCapital : centsToMoney(appliedRow.remaining_principal_cents);
  if (!Number.isFinite(currentCapital) || currentCapital < 0 || (balanceSource === "statement" && moneyToCents(currentCapital) > schedule.principal_cents)) return mutationError("validation", "Revisa el capital pendiente del estado de cuenta.");
  if (new Decimal(capitalPayment).greaterThan(currentCapital)) return mutationError("validation", "El abono no puede superar el capital pendiente.");
  const newCapital = new Decimal(currentCapital).minus(capitalPayment).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const remainingMonths = futureRows.length;
  const quote = calculateSimpleInterestQuote(newCapital, Number(loan.annual_rate), remainingMonths);
  const rows = calculatePaymentSchedule({ principal: quote.principal, interestTotal: quote.interestTotal, months: remainingMonths, firstDueDate: body.nextPaymentDate, firstPaymentNumber: paymentNumber + 1 });
  const originalFutureInterestCents = futureRows.reduce((sum, row) => sum + row.interest_cents, 0);
  const customerValue = loan.customers as unknown;
  const customer = (Array.isArray(customerValue) ? customerValue[0] : customerValue) as { name?: string } | null;
  const details = { transactionMode, paymentNumber, transactionDate: body.transactionDate, lastPaymentDate: body.lastPaymentDate, nextPaymentDate: body.nextPaymentDate, balanceSource, capitalPayment, currentCapital, newCapital, originalFutureInterest: centsToMoney(originalFutureInterestCents), newFutureInterest: quote.interestTotal, newScheduledBalance: quote.total, regularPayment: centsToMoney(appliedRow.payment_cents) };
  const command: PostCapitalPaymentCommand = {
    idempotencyKey: body.idempotencyKey, organizationId: session.organizationId, loanId: loan.id, expectedLoanVersion,
    transactionMode, paymentNumber, transactionDate: body.transactionDate, lastPaymentDate: body.lastPaymentDate, nextPaymentDate: body.nextPaymentDate, balanceSource,
    capitalPaymentCents: moneyToCents(capitalPayment), regularPaymentCents: moneyToCents(centsToMoney(appliedRow.payment_cents)),
    currentCapitalCents: moneyToCents(currentCapital), newCapitalCents: moneyToCents(newCapital), originalFutureInterestCents: moneyToCents(centsToMoney(originalFutureInterestCents)),
    newFutureInterestCents: moneyToCents(quote.interestTotal), newScheduledBalanceCents: moneyToCents(quote.total), newMonthlyPaymentCents: moneyToCents(quote.monthly), newFinalPaymentCents: moneyToCents(quote.finalPayment), remainingMonths,
    schedule: persistSchedule(rows), paymentMethod: text(body.paymentMethod, 80), paymentReference: text(body.paymentReference, 120), receivedBy: text(body.receivedBy, 80), notes: text(body.notes, 1000),
    snapshot: { version: DOCUMENT_SNAPSHOT_VERSION, calculationVersion: CALCULATION_VERSION, documentKind: "capital_payment_record", issuedAt: `${body.transactionDate}T00:00:00.000Z`, organizationName: session.company, customerName: customer?.name || "Cliente", accountReference: loan.account_reference, payload: { details: { ...details, paymentMethod: text(body.paymentMethod, 80), paymentReference: text(body.paymentReference, 120), receivedBy: text(body.receivedBy, 80), notes: text(body.notes, 1000) }, revisedQuote: quote, revisedSchedule: rows, notice: "Las cuotas ordinarias se administran por separado." } },
    ...(replacesTransactionId ? { replacesTransactionId } : {}),
  };
  const { data, error } = await supabase.rpc("post_capital_payment", { command });
  if (error) return mapDatabaseMutationError(error);
  return NextResponse.json<MutationResult<PostedTransaction>>({ ok: true, data: data as PostedTransaction }, { headers: { "Cache-Control": "no-store" } });
}
function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
async function validateReplacement(supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, value: unknown, organizationId: string, loanId: string): Promise<string | null | false> {
  if (value === undefined || value === null || value === "") return null;
  if (!isUuid(value)) return false;
  const { data } = await supabase.from("transactions").select("id").eq("id", value).eq("organization_id", organizationId).eq("loan_id", loanId).eq("type", "capital_payment").eq("status", "voided").maybeSingle();
  return data?.id || false;
}
