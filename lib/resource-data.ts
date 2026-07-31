import type { PortalSession } from "./current-portal-session";
import { centsToMoney } from "./domain";
import { createSupabaseServerClient } from "./supabase/server";

export type ResourceActivity = {
  documentNumber: string;
  effectiveDate: string;
  loanId: string;
  accountReference: string;
  customerName: string;
  type: "loan_origination" | "capital_payment" | "payment_adjustment";
};

export type ResourceLoan = {
  id: string;
  customerId: string;
  customerName: string;
  accountReference: string;
  price: number;
  downPayment: number;
  originalPrincipal: number;
  annualRate: number;
  termMonths: number;
  firstDueDate: string;
  currentPrincipal: number;
  remainingMonths: number;
  regularPayment: number;
  finalPayment: number;
  latestActivity: ResourceActivity | null;
  documentNumbers: string[];
  updatedAt: string;
};

export type ResourceCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  financingCount: number;
  accountReferences: string[];
  latestActivityAt: string;
  updatedAt: string;
};

export type ResourceDirectory = {
  customers: ResourceCustomer[];
  loans: ResourceLoan[];
  activities: ResourceActivity[];
};

export async function loadResourceDirectory(session: PortalSession): Promise<ResourceDirectory> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("unavailable");

  const [customersResult, loansResult, schedulesResult, transactionsResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id,name,phone,email,updated_at")
      .eq("organization_id", session.organizationId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("loans")
      .select("id,customer_id,account_reference,price_cents,down_payment_cents,original_principal_cents,annual_rate,term_months,first_due_date,current_schedule_version_id,updated_at")
      .eq("organization_id", session.organizationId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    supabase
      .from("schedule_versions")
      .select("id,principal_cents,remaining_months,regular_payment_cents,final_payment_cents")
      .eq("organization_id", session.organizationId)
      .eq("status", "active"),
    supabase
      .from("transactions")
      .select("loan_id,type,effective_date,document_number,created_at")
      .eq("organization_id", session.organizationId)
      .eq("status", "posted")
      .order("created_at", { ascending: false }),
  ]);

  const error = customersResult.error || loansResult.error || schedulesResult.error || transactionsResult.error;
  if (error) throw new Error(error.message);

  const customerRows = customersResult.data || [];
  const loanRows = loansResult.data || [];
  const scheduleById = new Map((schedulesResult.data || []).map((schedule) => [schedule.id, schedule]));
  const customerNameById = new Map(customerRows.map((customer) => [customer.id, customer.name]));
  const loanById = new Map(loanRows.map((loan) => [loan.id, loan]));
  type TransactionRow = NonNullable<typeof transactionsResult.data>[number];
  const transactionsByLoan = new Map<string, TransactionRow[]>();

  for (const transaction of transactionsResult.data || []) {
    const current = transactionsByLoan.get(transaction.loan_id) || [];
    current.push(transaction);
    transactionsByLoan.set(transaction.loan_id, current);
  }

  const activities: ResourceActivity[] = (transactionsResult.data || []).flatMap((transaction) => {
    const loan = loanById.get(transaction.loan_id);
    if (!loan) return [];
    return [{
      documentNumber: transaction.document_number,
      effectiveDate: transaction.effective_date,
      loanId: loan.id,
      accountReference: loan.account_reference,
      customerName: customerNameById.get(loan.customer_id) || "Cliente archivado",
      type: transaction.type as ResourceActivity["type"],
    }];
  });

  const loans: ResourceLoan[] = loanRows.map((loan) => {
    const schedule = scheduleById.get(loan.current_schedule_version_id || "");
    const loanTransactions = transactionsByLoan.get(loan.id) || [];
    const latest = activities.find((activity) => activity.loanId === loan.id) || null;
    return {
      id: loan.id,
      customerId: loan.customer_id,
      customerName: customerNameById.get(loan.customer_id) || "Cliente archivado",
      accountReference: loan.account_reference,
      price: centsToMoney(loan.price_cents),
      downPayment: centsToMoney(loan.down_payment_cents),
      originalPrincipal: centsToMoney(loan.original_principal_cents),
      annualRate: Number(loan.annual_rate),
      termMonths: loan.term_months,
      firstDueDate: loan.first_due_date,
      currentPrincipal: centsToMoney(schedule?.principal_cents ?? loan.original_principal_cents),
      remainingMonths: schedule?.remaining_months ?? loan.term_months,
      regularPayment: centsToMoney(schedule?.regular_payment_cents ?? 0),
      finalPayment: centsToMoney(schedule?.final_payment_cents ?? 0),
      latestActivity: latest,
      documentNumbers: loanTransactions.map((transaction) => transaction.document_number),
      updatedAt: loan.updated_at,
    };
  });

  const loansByCustomer = new Map<string, ResourceLoan[]>();
  for (const loan of loans) {
    const current = loansByCustomer.get(loan.customerId) || [];
    current.push(loan);
    loansByCustomer.set(loan.customerId, current);
  }

  const customers: ResourceCustomer[] = customerRows.map((customer) => {
    const customerLoans = loansByCustomer.get(customer.id) || [];
    const latestActivityAt = customerLoans
      .map((loan) => loan.latestActivity?.effectiveDate || loan.updatedAt)
      .sort()
      .at(-1) || customer.updated_at;
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      financingCount: customerLoans.length,
      accountReferences: customerLoans.map((loan) => loan.accountReference),
      latestActivityAt,
      updatedAt: customer.updated_at,
    };
  });

  return { customers, loans, activities };
}

export function matchesSearch(query: string, ...values: Array<string | number | null | undefined>) {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return values.some((value) => normalizeSearch(String(value ?? "")).includes(needle));
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-GT").trim();
}
