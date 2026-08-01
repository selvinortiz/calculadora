import Decimal from "decimal.js";
import type {
  PaymentCreditAdjustment,
  PaymentScheduleRow,
  SimpleInterestRecalculation,
} from "./finance";
import type { Json } from "./database.types";

export const CALCULATION_VERSION = "simple-interest-v2-cents";
export const DOCUMENT_SNAPSHOT_VERSION = 1 as const;
export const MAX_MONEY_CENTS = 100_000_000_000;

export type MoneyCents = number & { readonly __brand: "MoneyCents" };
export type AnnualRateDecimal = string & { readonly __brand: "AnnualRateDecimal" };
export type OrganizationRole = "owner" | "operator";
export type TransactionType =
  | "loan_origination"
  | "capital_payment"
  | "payment_adjustment";
export type TransactionStatus = "posted" | "voided";

export type DirectoryOrganization = {
  id: string;
  name: string;
  defaultRecipient: string;
  financingPrefix: string;
  receiptPrefix: string;
  adjustmentPrefix: string;
  nextFinancingNumber: number;
  nextReceiptNumber: number;
  nextAdjustmentNumber: number;
};

export type DirectoryInstallment = {
  paymentNumber: number;
  dueDate: string;
  payment: number;
  remainingPrincipal: number;
};

export type DirectoryCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  updatedAt: string;
};

export type DirectoryLoan = {
  id: string;
  customerId: string;
  customerName: string;
  accountReference: string;
  displayName: string;
  price: number;
  downPayment: number;
  principal: number;
  annualRate: number;
  termMonths: number;
  firstDueDate: string;
  version: number;
  currentScheduleVersionId: string;
  currentPrincipal: number;
  remainingMonths: number;
  currentPayment: number;
  currentFinalPayment: number;
  nextPaymentNumber: number;
  nextDueDate: string;
  installments: DirectoryInstallment[];
  updatedAt: string;
};

export type DurableDirectory = {
  organization: DirectoryOrganization | null;
  role: OrganizationRole | null;
  customers: DirectoryCustomer[];
  loans: DirectoryLoan[];
};

export type DocumentSnapshotV1 = {
  version: typeof DOCUMENT_SNAPSHOT_VERSION;
  calculationVersion: typeof CALCULATION_VERSION;
  documentKind: "payment_schedule" | "capital_payment_record" | "payment_adjustment_record";
  documentNumber?: string;
  issuedAt: string;
  organizationName: string;
  customerName: string;
  accountReference: string;
  payload: Record<string, Json | undefined>;
};

export type PostLoanCommand = {
  idempotencyKey: string;
  organizationId: string;
  customerId: string;
  accountReference: string;
  priceCents: MoneyCents;
  downPaymentCents: MoneyCents;
  principalCents: MoneyCents;
  annualRate: AnnualRateDecimal;
  termMonths: number;
  firstDueDate: string;
  issueDate: string;
  schedule: Array<PersistedScheduleRow>;
  snapshot: DocumentSnapshotV1;
  replacesTransactionId?: string;
};

export type PostCapitalPaymentCommand = {
  idempotencyKey: string;
  organizationId: string;
  loanId: string;
  expectedLoanVersion: number;
  transactionMode: "standalone" | "combined";
  paymentNumber: number;
  transactionDate: string;
  lastPaymentDate: string | null;
  nextPaymentDate: string;
  balanceSource: "calculated" | "statement";
  capitalPaymentCents: MoneyCents;
  regularPaymentCents: MoneyCents;
  currentCapitalCents: MoneyCents;
  newCapitalCents: MoneyCents;
  originalFutureInterestCents: MoneyCents;
  newFutureInterestCents: MoneyCents;
  newScheduledBalanceCents: MoneyCents;
  newMonthlyPaymentCents: MoneyCents;
  newFinalPaymentCents: MoneyCents;
  remainingMonths: number;
  schedule: Array<PersistedScheduleRow>;
  paymentMethod: string;
  paymentReference: string;
  receivedBy: string;
  notes: string;
  snapshot: DocumentSnapshotV1;
  replacesTransactionId?: string;
};

export type PostPaymentAdjustmentCommand = {
  idempotencyKey: string;
  organizationId: string;
  loanId: string;
  expectedLoanVersion: number;
  paymentNumber: number;
  paymentDate: string;
  nextPaymentDate: string;
  scheduledPaymentCents: MoneyCents;
  receivedPaymentCents: MoneyCents;
  creditBalanceCents: MoneyCents;
  adjustedNextPaymentCents: MoneyCents;
  paymentReference: string;
  adjustedBy: string;
  notes: string;
  snapshot: DocumentSnapshotV1;
  replacesTransactionId?: string;
};

export type PostedTransaction = {
  transactionId: string;
  loanId: string;
  documentNumber: string;
  loanVersion: number;
  scheduleVersionId: string | null;
  idempotentReplay: boolean;
};

export type EditLoanCommand = Omit<PostLoanCommand, "idempotencyKey" | "organizationId" | "customerId" | "replacesTransactionId"> & {
  transactionId: string;
  transactionType: "loan_origination";
  organizationId: string;
  expectedLoanVersion: number;
};

export type EditCapitalPaymentCommand = Omit<PostCapitalPaymentCommand, "idempotencyKey" | "organizationId" | "loanId" | "expectedLoanVersion" | "replacesTransactionId"> & {
  transactionId: string;
  transactionType: "capital_payment";
  organizationId: string;
  expectedLoanVersion: number;
};

export type EditPaymentAdjustmentCommand = Omit<PostPaymentAdjustmentCommand, "idempotencyKey" | "organizationId" | "loanId" | "expectedLoanVersion" | "replacesTransactionId"> & {
  transactionId: string;
  transactionType: "payment_adjustment";
  organizationId: string;
  expectedLoanVersion: number;
};

export type EditTransactionCommand =
  | EditLoanCommand
  | EditCapitalPaymentCommand
  | EditPaymentAdjustmentCommand;

export type EditedTransaction = Omit<PostedTransaction, "idempotentReplay"> & {
  edited: true;
};

export type MutationErrorCode =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "duplicate"
  | "conflict"
  | "unavailable";

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: MutationErrorCode; message: string };

export type PersistedScheduleRow = {
  paymentNumber: number;
  dueDate: string;
  principalCents: MoneyCents;
  interestCents: MoneyCents;
  paymentCents: MoneyCents;
  remainingPrincipalCents: MoneyCents;
};

export function moneyToCents(value: string | number): MoneyCents {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.isNegative()) {
    throw new RangeError("Money must be finite and non-negative.");
  }
  const cents = decimal.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) {
    throw new RangeError("Money exceeds the supported range.");
  }
  return cents as MoneyCents;
}

export function centsToMoney(value: MoneyCents | number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) {
    throw new RangeError("Money cents are outside the supported range.");
  }
  return new Decimal(value).div(100).toNumber();
}

export function normalizeAnnualRate(value: string | number): AnnualRateDecimal {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.isNegative() || decimal.greaterThan(100)) {
    throw new RangeError("Annual rate must be between zero and 100.");
  }
  return decimal.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6) as AnnualRateDecimal;
}

export function persistSchedule(rows: PaymentScheduleRow[]): PersistedScheduleRow[] {
  return rows.map((row) => ({
    paymentNumber: row.paymentNumber,
    dueDate: row.dueDate,
    principalCents: moneyToCents(row.principal),
    interestCents: moneyToCents(row.interest),
    paymentCents: moneyToCents(row.payment),
    remainingPrincipalCents: moneyToCents(row.remainingPrincipal),
  }));
}

export function persistRecalculation(result: SimpleInterestRecalculation) {
  return {
    regularPaymentCents: moneyToCents(result.regularPayment),
    currentCapitalCents: moneyToCents(result.currentCapital),
    newCapitalCents: moneyToCents(result.newCapital),
    originalFutureInterestCents: moneyToCents(result.originalFutureInterest),
    newFutureInterestCents: moneyToCents(result.newFutureInterest),
    newScheduledBalanceCents: moneyToCents(result.newScheduledBalance),
    newMonthlyPaymentCents: moneyToCents(result.newMonthlyPayment),
    newFinalPaymentCents: moneyToCents(result.newFinalPayment),
  };
}

export function persistAdjustment(adjustment: PaymentCreditAdjustment) {
  return {
    scheduledPaymentCents: moneyToCents(adjustment.scheduledPayment),
    receivedPaymentCents: moneyToCents(adjustment.receivedPayment),
    creditBalanceCents: moneyToCents(adjustment.creditBalance),
    adjustedNextPaymentCents: moneyToCents(adjustment.adjustedNextPayment),
  };
}
