import { notFound, redirect } from "next/navigation";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { centsToMoney } from "@/lib/domain";
import { LoanDetail } from "./loan-detail";

export default async function LoanDetailPage({ params }: { params: Promise<{ loanId: string }> }) {
  const session = await getCurrentPortalSession();
  if (!session) redirect("/acceso");
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/acceso?no_disponible=1");
  const { loanId } = await params;
  const loadLoan = () => supabase.from("loans").select("id,account_reference,price_cents,down_payment_cents,original_principal_cents,annual_rate,term_months,first_due_date,status,version,current_schedule_version_id,customers!loans_customer_id_fkey(name,phone,email),current_schedule:schedule_versions!loans_current_schedule_fk(id,source_transaction_id,version_number,reason,calculation_version,principal_cents,future_interest_cents,remaining_months,regular_payment_cents,final_payment_cents,first_payment_number,first_due_date,installments!installments_schedule_version_id_fkey(payment_number,due_date,principal_cents,interest_cents,payment_cents,remaining_principal_cents)),transactions!transactions_loan_id_fkey(id,type,status,effective_date,document_number,depends_on_transaction_id,ledger_sequence,created_at,voided_at,void_reason,replaces_transaction_id,documents!documents_transaction_id_fkey(kind,snapshot_version,calculation_version,snapshot,issued_on))").eq("id", loanId).eq("organization_id", session.organizationId).abortSignal(AbortSignal.timeout(5_000)).maybeSingle();
  let loanResult = await loadLoan();
  if (loanResult.error) loanResult = await loadLoan();
  const { data: loan, error: loanError } = loanResult;
  if (loanError) throw new Error(loanError.message);
  if (!loan) notFound();
  const customerValue = loan.customers as unknown;
  const customer = (Array.isArray(customerValue) ? customerValue[0] : customerValue) as { name?: string; phone?: string; email?: string } | null;
  const scheduleValue = loan.current_schedule as unknown;
  const schedule = (Array.isArray(scheduleValue) ? scheduleValue[0] : scheduleValue) as CurrentSchedule | null;
  const installments = [...(schedule?.installments || [])].sort((first, second) => first.payment_number - second.payment_number);
  const transactions = [...(loan.transactions || [])].sort((first, second) => Number(first.ledger_sequence) - Number(second.ledger_sequence));
  return <main className="appPage"><LoanDetail role={session.role} loan={{ id: loan.id, accountReference: loan.account_reference, price: centsToMoney(loan.price_cents), downPayment: centsToMoney(loan.down_payment_cents), originalPrincipal: centsToMoney(loan.original_principal_cents), annualRate: Number(loan.annual_rate), termMonths: loan.term_months, firstDueDate: loan.first_due_date, status: loan.status, version: loan.version, customer: customer || { name: "Cliente" }, schedule: schedule ? { sourceTransactionId: schedule.source_transaction_id, versionNumber: schedule.version_number, reason: schedule.reason, calculationVersion: schedule.calculation_version, principal: centsToMoney(schedule.principal_cents), futureInterest: centsToMoney(schedule.future_interest_cents), remainingMonths: schedule.remaining_months, regularPayment: centsToMoney(schedule.regular_payment_cents), finalPayment: centsToMoney(schedule.final_payment_cents), firstPaymentNumber: schedule.first_payment_number, firstDueDate: schedule.first_due_date } : null, installments: installments.map((row) => ({ paymentNumber: row.payment_number, dueDate: row.due_date, principal: centsToMoney(row.principal_cents), interest: centsToMoney(row.interest_cents), payment: centsToMoney(row.payment_cents), remainingPrincipal: centsToMoney(row.remaining_principal_cents) })), transactions: transactions.map((transaction) => ({ id: transaction.id, type: transaction.type, status: transaction.status, effectiveDate: transaction.effective_date, documentNumber: transaction.document_number, dependsOnTransactionId: transaction.depends_on_transaction_id, ledgerSequence: Number(transaction.ledger_sequence), createdAt: transaction.created_at, voidedAt: transaction.voided_at, voidReason: transaction.void_reason, replacesTransactionId: transaction.replaces_transaction_id, documents: transaction.documents as unknown as Array<{ kind: string; snapshot_version: number; calculation_version: string; snapshot: Record<string, unknown>; issued_on: string }> })) }} /></main>;
}

type CurrentSchedule = {
  source_transaction_id: string;
  version_number: number;
  reason: string;
  calculation_version: string;
  principal_cents: number;
  future_interest_cents: number;
  remaining_months: number;
  regular_payment_cents: number;
  final_payment_cents: number;
  first_payment_number: number;
  first_due_date: string;
  installments: Array<{
    payment_number: number;
    due_date: string;
    principal_cents: number;
    interest_cents: number;
    payment_cents: number;
    remaining_principal_cents: number;
  }>;
};
