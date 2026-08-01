import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Decimal from "decimal.js";
import {
  calculatePaymentCreditAdjustment,
  calculatePaymentSchedule,
  calculateSimpleInterestQuote,
  validateLoanInputs,
} from "@/lib/finance";
import {
  CALCULATION_VERSION,
  DOCUMENT_SNAPSHOT_VERSION,
  centsToMoney,
  moneyToCents,
  normalizeAnnualRate,
  persistAdjustment,
  persistSchedule,
  type DocumentSnapshotV1,
  type EditedTransaction,
  type EditTransactionCommand,
  type MutationResult,
} from "@/lib/domain";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import {
  isIsoDate,
  isRecord,
  isSameOrigin,
  isUuid,
  mapDatabaseMutationError,
  mutationError,
} from "@/lib/mutation-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  if (!isSameOrigin(request)) return mutationError("forbidden", "Solicitud no permitida.");
  const session = await getCurrentPortalSession();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return mutationError("unavailable", "El servicio no está disponible.");
  if (!session) return mutationError("unauthorized", "Inicia sesión nuevamente.");
  if (session.role !== "owner") return mutationError("forbidden", "Solo el propietario puede editar registros.");

  const { transactionId } = await params;
  if (!isUuid(transactionId)) return mutationError("validation", "El registro no es válido.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return mutationError("validation", "Datos inválidos.");
  }
  if (!isRecord(body)) return mutationError("validation", "Datos inválidos.");

  const expectedLoanVersion = Number(body.expectedLoanVersion);
  if (!Number.isInteger(expectedLoanVersion) || expectedLoanVersion < 1) {
    return mutationError("validation", "Recarga el financiamiento e intenta de nuevo.");
  }

  const { data: transaction } = await supabase
    .from("transactions")
    .select("id,loan_id,type,status,document_number,depends_on_transaction_id,ledger_sequence,created_at")
    .eq("id", transactionId)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (!transaction || transaction.status !== "posted" || body.type !== transaction.type) {
    return mutationError("validation", "Este registro ya no se puede editar.");
  }
  const { data: laterTransaction } = await supabase
    .from("transactions")
    .select("id")
    .eq("organization_id", session.organizationId)
    .eq("status", "posted")
    .eq("loan_id", transaction.loan_id)
    .gt("ledger_sequence", transaction.ledger_sequence)
    .limit(1)
    .maybeSingle();
  if (laterTransaction) return mutationError("conflict", "Anula primero las operaciones posteriores, en orden inverso.");

  const [{ data: loan }, { data: document }] = await Promise.all([
    supabase
      .from("loans")
      .select("id,account_reference,price_cents,down_payment_cents,original_principal_cents,annual_rate,term_months,first_due_date,version,current_schedule_version_id,customers!loans_customer_id_fkey(name)")
      .eq("id", transaction.loan_id)
      .eq("organization_id", session.organizationId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("documents")
      .select("kind,snapshot")
      .eq("transaction_id", transaction.id)
      .maybeSingle(),
  ]);
  if (!loan || !document) return mutationError("validation", "El financiamiento ya no está activo.");
  if (loan.version !== expectedLoanVersion) {
    return mutationError("conflict", "El financiamiento cambió en otra sesión. Recarga e intenta de nuevo.");
  }

  const oldSnapshot = asRecord(document.snapshot);
  const customerValue = loan.customers as unknown;
  const customer = (Array.isArray(customerValue) ? customerValue[0] : customerValue) as { name?: string } | null;
  const organizationName = stringValue(oldSnapshot.organizationName, session.company);
  const customerName = stringValue(oldSnapshot.customerName, customer?.name || "Cliente");

  let command: EditTransactionCommand | null = null;
  try {
    if (transaction.type === "loan_origination") {
      command = buildLoanEdit({ body, transactionId, expectedLoanVersion, organizationId: session.organizationId, organizationName, customerName });
    } else if (transaction.type === "capital_payment") {
      command = await buildCapitalPaymentEdit({ body, transactionId, expectedLoanVersion, organizationId: session.organizationId, organizationName, customerName, loan, supabase });
    } else if (transaction.type === "payment_adjustment") {
      command = await buildAdjustmentEdit({ body, transactionId, expectedLoanVersion, organizationId: session.organizationId, organizationName, customerName, loan, dependencyTransactionId: transaction.depends_on_transaction_id, supabase });
    }
  } catch {
    command = null;
  }

  if (!command) return mutationError("validation", validationMessage(transaction.type));
  const { data, error } = await admin.rpc("server_edit_transaction", { actor_id: session.userId, command });
  if (error) return mapDatabaseMutationError(error);
  return NextResponse.json<MutationResult<EditedTransaction>>(
    { ok: true, data: data as EditedTransaction },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function buildLoanEdit({
  body,
  transactionId,
  expectedLoanVersion,
  organizationId,
  organizationName,
  customerName,
}: EditContext) {
  const price = Number(body.price);
  const downPayment = Number(body.downPayment);
  const annualRate = Number(body.annualRate);
  const termMonths = Number(body.termMonths);
  const accountReference = text(body.accountReference, 80);
  const firstDueDate = body.firstDueDate;
  const issueDate = body.issueDate;
  if (
    Object.keys(validateLoanInputs({ price, downPayment, annualRate })).length
    || !Number.isInteger(termMonths)
    || termMonths < 2
    || termMonths > 360
    || !accountReference
    || !isIsoDate(firstDueDate)
    || !isIsoDate(issueDate)
    || firstDueDate <= issueDate
  ) return null;

  const principal = price - downPayment;
  if (principal <= 0) return null;
  const quote = calculateSimpleInterestQuote(principal, annualRate, termMonths);
  const schedule = calculatePaymentSchedule({
    principal: quote.principal,
    interestTotal: quote.interestTotal,
    months: termMonths,
    firstDueDate,
  });
  const snapshot: DocumentSnapshotV1 = {
    version: DOCUMENT_SNAPSHOT_VERSION,
    calculationVersion: CALCULATION_VERSION,
    documentKind: "payment_schedule",
    issuedAt: `${issueDate}T00:00:00.000Z`,
    organizationName,
    customerName,
    accountReference,
    payload: { price, downPayment, principal: quote.principal, annualRate: normalizeAnnualRate(annualRate), termMonths, firstDueDate, issueDate, quote, schedule, notice: "Las cuotas ordinarias se administran por separado." },
  };
  return {
    transactionId,
    transactionType: "loan_origination" as const,
    organizationId,
    expectedLoanVersion,
    accountReference,
    priceCents: moneyToCents(price),
    downPaymentCents: moneyToCents(downPayment),
    principalCents: moneyToCents(principal),
    annualRate: normalizeAnnualRate(annualRate),
    termMonths,
    firstDueDate,
    issueDate,
    schedule: persistSchedule(schedule),
    snapshot,
  };
}

async function buildCapitalPaymentEdit({
  body,
  transactionId,
  expectedLoanVersion,
  organizationId,
  organizationName,
  customerName,
  loan,
  supabase,
}: EditContext & { loan: LoanRow; supabase: SupabaseClient }) {
  const paymentNumber = Number(body.paymentNumber);
  const capitalPayment = Number(body.capitalPayment);
  const transactionMode: "combined" | "standalone" | null = body.transactionMode === "combined" ? "combined" : body.transactionMode === "standalone" ? "standalone" : null;
  const balanceSource: "statement" | "calculated" | null = body.balanceSource === "statement" ? "statement" : body.balanceSource === "calculated" ? "calculated" : null;
  const transactionDate = body.transactionDate;
  const nextPaymentDate = body.nextPaymentDate;
  const lastPaymentDate = body.lastPaymentDate === "" || body.lastPaymentDate === null ? null : body.lastPaymentDate;
  if (
    !Number.isInteger(paymentNumber)
    || paymentNumber < 1
    || !Number.isFinite(capitalPayment)
    || capitalPayment <= 0
    || !transactionMode
    || !balanceSource
    || !isIsoDate(transactionDate)
    || !isIsoDate(nextPaymentDate)
    || nextPaymentDate <= transactionDate
    || (lastPaymentDate !== null && !isIsoDate(lastPaymentDate))
  ) return null;

  const { data: revisedSchedule } = await supabase
    .from("schedule_versions")
    .select("id,previous_version_id")
    .eq("source_transaction_id", transactionId)
    .maybeSingle();
  if (!revisedSchedule?.previous_version_id) return null;
  const [{ data: previousSchedule }, { data: installments }] = await Promise.all([
    supabase
      .from("schedule_versions")
      .select("principal_cents")
      .eq("id", revisedSchedule.previous_version_id)
      .maybeSingle(),
    supabase
      .from("installments")
      .select("payment_number,payment_cents,interest_cents,remaining_principal_cents")
      .eq("schedule_version_id", revisedSchedule.previous_version_id)
      .order("payment_number"),
  ]);
  const appliedRow = installments?.find((row) => row.payment_number === paymentNumber);
  const futureRows = installments?.filter((row) => row.payment_number > paymentNumber) || [];
  if (!previousSchedule || !appliedRow || futureRows.length === 0) return null;

  const statementCapital = Number(body.statementCapital);
  const currentCapital = balanceSource === "statement" ? statementCapital : centsToMoney(appliedRow.remaining_principal_cents);
  if (
    !Number.isFinite(currentCapital)
    || currentCapital < 0
    || (balanceSource === "statement" && moneyToCents(currentCapital) > previousSchedule.principal_cents)
    || new Decimal(capitalPayment).greaterThan(currentCapital)
  ) return null;
  const newCapital = new Decimal(currentCapital).minus(capitalPayment).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const remainingMonths = futureRows.length;
  const quote = calculateSimpleInterestQuote(newCapital, Number(loan.annual_rate), remainingMonths);
  const rows = calculatePaymentSchedule({
    principal: quote.principal,
    interestTotal: quote.interestTotal,
    months: remainingMonths,
    firstDueDate: nextPaymentDate,
    firstPaymentNumber: paymentNumber + 1,
  });
  const originalFutureInterestCents = futureRows.reduce((sum, row) => sum + row.interest_cents, 0);
  const paymentMethod = text(body.paymentMethod, 80);
  const paymentReference = text(body.paymentReference, 120);
  const receivedBy = text(body.receivedBy, 80);
  const notes = text(body.notes, 1000);
  if (!paymentMethod || !receivedBy) return null;
  const details = {
    transactionMode,
    paymentNumber,
    transactionDate,
    lastPaymentDate,
    nextPaymentDate,
    balanceSource,
    capitalPayment,
    currentCapital,
    newCapital,
    originalFutureInterest: centsToMoney(originalFutureInterestCents),
    newFutureInterest: quote.interestTotal,
    newScheduledBalance: quote.total,
    regularPayment: centsToMoney(appliedRow.payment_cents),
    paymentMethod,
    paymentReference,
    receivedBy,
    notes,
  };
  const snapshot: DocumentSnapshotV1 = {
    version: DOCUMENT_SNAPSHOT_VERSION,
    calculationVersion: CALCULATION_VERSION,
    documentKind: "capital_payment_record",
    issuedAt: `${transactionDate}T00:00:00.000Z`,
    organizationName,
    customerName,
    accountReference: loan.account_reference,
    payload: { details, revisedQuote: quote, revisedSchedule: rows, notice: "Las cuotas ordinarias se administran por separado." },
  };
  return {
    transactionId,
    transactionType: "capital_payment" as const,
    organizationId,
    expectedLoanVersion,
    transactionMode,
    paymentNumber,
    transactionDate,
    lastPaymentDate,
    nextPaymentDate,
    balanceSource,
    capitalPaymentCents: moneyToCents(capitalPayment),
    regularPaymentCents: moneyToCents(centsToMoney(appliedRow.payment_cents)),
    currentCapitalCents: moneyToCents(currentCapital),
    newCapitalCents: moneyToCents(newCapital),
    originalFutureInterestCents: moneyToCents(centsToMoney(originalFutureInterestCents)),
    newFutureInterestCents: moneyToCents(quote.interestTotal),
    newScheduledBalanceCents: moneyToCents(quote.total),
    newMonthlyPaymentCents: moneyToCents(quote.monthly),
    newFinalPaymentCents: moneyToCents(quote.finalPayment),
    remainingMonths,
    schedule: persistSchedule(rows),
    paymentMethod,
    paymentReference,
    receivedBy,
    notes,
    snapshot,
  };
}

async function buildAdjustmentEdit({
  body,
  transactionId,
  expectedLoanVersion,
  organizationId,
  organizationName,
  customerName,
  loan,
  dependencyTransactionId,
  supabase,
}: EditContext & { loan: LoanRow; dependencyTransactionId: string | null; supabase: SupabaseClient }) {
  const paymentNumber = Number(body.paymentNumber);
  const receivedPayment = Number(body.receivedPayment);
  const paymentDate = body.paymentDate;
  const nextPaymentDate = body.nextPaymentDate;
  if (
    !Number.isInteger(paymentNumber)
    || paymentNumber < 1
    || !Number.isFinite(receivedPayment)
    || !isIsoDate(paymentDate)
    || !isIsoDate(nextPaymentDate)
    || nextPaymentDate <= paymentDate
    || !dependencyTransactionId
  ) return null;

  const { data: schedule } = await supabase
    .from("schedule_versions")
    .select("id")
    .eq("source_transaction_id", dependencyTransactionId)
    .maybeSingle();
  if (!schedule) return null;
  const { data: installmentRows } = await supabase
    .from("installments")
    .select("payment_number,payment_cents")
    .eq("schedule_version_id", schedule.id)
    .in("payment_number", [paymentNumber, paymentNumber + 1]);
  const installment = installmentRows?.find((row) => row.payment_number === paymentNumber);
  const nextInstallment = installmentRows?.find((row) => row.payment_number === paymentNumber + 1);
  if (!installment || !nextInstallment) return null;

  let adjustment;
  try {
    adjustment = calculatePaymentCreditAdjustment({
      paymentNumber,
      scheduledPayment: centsToMoney(installment.payment_cents),
      receivedPayment,
    });
  } catch {
    return null;
  }
  const persisted = persistAdjustment(adjustment);
  const paymentReference = text(body.paymentReference, 120);
  const adjustedBy = text(body.adjustedBy, 80);
  const notes = text(body.notes, 1000);
  if (!adjustedBy) return null;
  const snapshot: DocumentSnapshotV1 = {
    version: DOCUMENT_SNAPSHOT_VERSION,
    calculationVersion: CALCULATION_VERSION,
    documentKind: "payment_adjustment_record",
    issuedAt: `${paymentDate}T00:00:00.000Z`,
    organizationName,
    customerName,
    accountReference: loan.account_reference,
    payload: { adjustment, paymentDate, nextPaymentDate, paymentReference, adjustedBy, notes, notice: "Este ajuste se aplica únicamente a la cuota siguiente." },
  };
  return {
    transactionId,
    transactionType: "payment_adjustment" as const,
    organizationId,
    expectedLoanVersion,
    paymentNumber,
    paymentDate,
    nextPaymentDate,
    ...persisted,
    paymentReference,
    adjustedBy,
    notes,
    snapshot,
  };
}

type EditContext = {
  body: Record<string, unknown>;
  transactionId: string;
  expectedLoanVersion: number;
  organizationId: string;
  organizationName: string;
  customerName: string;
};

type LoanRow = {
  account_reference: string;
  annual_rate: number;
};

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

function text(value: unknown, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > max) throw new RangeError("text_too_long");
  return result;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validationMessage(type: string) {
  if (type === "loan_origination") return "Revisa los datos del financiamiento.";
  if (type === "capital_payment") return "Revisa los datos del abono.";
  return "Revisa los datos del ajuste.";
}
