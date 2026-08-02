import type {
  PaymentCreditAdjustment,
  PaymentScheduleRow,
  SimpleInterestRecalculation,
} from "@/lib/finance";
import { PaymentAdjustmentRecord } from "./payment-adjustment-record";
import { PaymentRecord, type RecordDetails } from "./payment-record";
import { PaymentScheduleDocument } from "./payment-schedule-document";
import styles from "./posted-document-bundle.module.css";

export type PostedSnapshotDocument = {
  kind: string;
  snapshot_version: number;
  calculation_version: string;
  snapshot: Record<string, unknown>;
  issued_on: string;
};

export type PostedLoanTerms = {
  price: number;
  downPayment: number;
  originalPrincipal: number;
  annualRate: number;
  termMonths: number;
};

type PostedDocumentBundleProps = {
  active: boolean;
  document: PostedSnapshotDocument;
  documentNumber: string;
  loan: PostedLoanTerms;
  printKey: string;
};

export function PostedDocumentBundle({
  active,
  document,
  documentNumber,
  loan,
  printKey,
}: PostedDocumentBundleProps) {
  if (!isPostedDocumentComplete(document)) {
    return (
      <div className={styles.incompleteDocument} role="status">
        <strong>Documento histórico incompleto</strong>
        <p>Este registro no contiene la instantánea necesaria para reconstruir o reimprimir el documento con fidelidad. Los importes faltantes no se muestran como cero.</p>
      </div>
    );
  }

  const snapshot = asRecord(document.snapshot);
  const payload = asRecord(snapshot.payload);
  const organizationName = stringValue(snapshot.organizationName);
  const customerName = stringValue(snapshot.customerName);
  const accountReference = stringValue(snapshot.accountReference);
  const issueDate = dateValue(snapshot.issuedAt) || document.issued_on;

  if (document.kind === "payment_schedule") {
    const quote = asRecord(payload.quote);
    const rows = scheduleRows(payload.schedule);
    const price = numberValue(payload.price, loan.price);
    const downPayment = numberValue(payload.downPayment, loan.downPayment);
    const principal = numberValue(payload.principal, loan.originalPrincipal);
    const termMonths = numberValue(payload.termMonths, loan.termMonths);

    return (
      <div
        className={styles.bundle}
        data-posted-document={printKey}
        data-print-document={active ? printKey : undefined}
      >
        <PaymentScheduleDocument
          accountReference={accountReference}
          annualRate={numberValue(payload.annualRate, loan.annualRate)}
          creditorName={organizationName}
          debtorName={customerName}
          documentNumber={documentNumber}
          downPayment={downPayment}
          finalPayment={numberValue(quote.finalPayment, rows.at(-1)?.payment ?? 0)}
          interestTotal={numberValue(quote.interestTotal, sumRows(rows, "interest"))}
          issueDate={dateValue(payload.issueDate) || issueDate}
          monthlyPayment={numberValue(quote.monthly, rows[0]?.payment ?? 0)}
          originalTermMonths={termMonths}
          price={price}
          principal={principal}
          rows={rows}
          scheduledTotal={numberValue(quote.total, sumRows(rows, "payment"))}
          variant="original"
        />
      </div>
    );
  }

  if (document.kind === "capital_payment_record") {
    const details = asRecord(payload.details);
    const revisedQuote = asRecord(payload.revisedQuote);
    const revisedSchedule = scheduleRows(payload.revisedSchedule);
    const paymentNumber = integerValue(details.paymentNumber);
    const capitalPayment = numberValue(details.capitalPayment);
    const currentCapital = numberValue(details.currentCapital);
    const newCapital = numberValue(details.newCapital);
    const originalFutureInterest = numberValue(details.originalFutureInterest);
    const newFutureInterest = numberValue(details.newFutureInterest);
    const regularPayment = numberValue(details.regularPayment);
    const newScheduledBalance = numberValue(
      details.newScheduledBalance,
      numberValue(revisedQuote.total, sumRows(revisedSchedule, "payment")),
    );
    const newMonthlyPayment = numberValue(
      revisedQuote.monthly,
      revisedSchedule[0]?.payment ?? 0,
    );
    const newFinalPayment = numberValue(
      revisedQuote.finalPayment,
      revisedSchedule.at(-1)?.payment ?? 0,
    );
    const transactionMode = details.transactionMode === "combined" ? "combined" : "standalone";
    const balanceSource = details.balanceSource === "statement" ? "statement" : "calculated";
    const transactionDate = dateValue(details.transactionDate) || issueDate;
    const result: SimpleInterestRecalculation = {
      applyAfterPayment: paymentNumber,
      remainingMonths: revisedSchedule.length || integerValue(revisedQuote.months),
      regularPayment,
      paymentThisMonth: transactionMode === "combined" ? regularPayment + capitalPayment : capitalPayment,
      principalAppliedByRegularPayment: 0,
      interestAppliedByRegularPayment: 0,
      currentCapital,
      newCapital,
      originalFutureInterest,
      interestAdjustmentFromRecalculation: 0,
      interestReductionFromCapitalPayment: originalFutureInterest - newFutureInterest,
      newFutureInterest,
      originalScheduledBalance: currentCapital + originalFutureInterest,
      newScheduledBalance,
      totalInterestReduction: originalFutureInterest - newFutureInterest,
      newMonthlyPayment,
      newFinalPayment,
    };
    const recordDetails: RecordDetails = {
      documentType: "record",
      debtorName: customerName,
      creditorName: organizationName,
      lotReference: accountReference,
      receiptNumber: documentNumber,
      paymentMethod: stringValue(details.paymentMethod),
      paymentReference: stringValue(details.paymentReference),
      receivedBy: stringValue(details.receivedBy),
      notes: stringValue(details.notes),
    };

    return (
      <div
        className={styles.bundle}
        data-posted-document={printKey}
        data-print-document={active ? printKey : undefined}
      >
        <PaymentRecord
          annualRate={loan.annualRate}
          balanceSource={balanceSource}
          capitalPayment={capitalPayment}
          details={recordDetails}
          downPayment={loan.downPayment}
          lastPaymentDate={dateValue(details.lastPaymentDate)}
          nextPaymentDate={dateValue(details.nextPaymentDate)}
          paymentNumber={paymentNumber}
          price={loan.price}
          result={result}
          termMonths={loan.termMonths}
          transactionDate={transactionDate}
          transactionMode={transactionMode}
        />
        {revisedSchedule.length > 0 && (
          <PaymentScheduleDocument
            accountReference={accountReference}
            annualRate={loan.annualRate}
            capitalPayment={capitalPayment}
            creditorName={organizationName}
            debtorName={customerName}
            documentNumber={documentNumber}
            downPayment={loan.downPayment}
            finalPayment={newFinalPayment}
            interestTotal={newFutureInterest}
            issueDate={transactionDate}
            monthlyPayment={newMonthlyPayment}
            originalTermMonths={loan.termMonths}
            previousPaymentNumber={paymentNumber}
            previousPrincipal={currentCapital}
            price={loan.price}
            principal={newCapital}
            rows={revisedSchedule}
            scheduledTotal={newScheduledBalance}
            variant="updated"
          />
        )}
      </div>
    );
  }

  if (document.kind === "payment_adjustment_record") {
    const adjustment = adjustmentValue(payload.adjustment);

    return (
      <div
        className={styles.bundle}
        data-posted-document={printKey}
        data-print-document={active ? printKey : undefined}
      >
        <PaymentAdjustmentRecord
          adjustment={adjustment}
          details={{
            debtorName: customerName,
            creditorName: organizationName,
            accountReference,
            documentNumber,
            adjustedBy: stringValue(payload.adjustedBy),
            paymentReference: stringValue(payload.paymentReference),
            notes: stringValue(payload.notes),
          }}
          issueDate={issueDate}
          nextPaymentDate={dateValue(payload.nextPaymentDate)}
          paymentDate={dateValue(payload.paymentDate)}
        />
      </div>
    );
  }

  return null;
}

export function isPostedDocumentComplete(document: PostedSnapshotDocument) {
  const snapshot = asRecord(document.snapshot);
  const payload = asRecord(snapshot.payload);
  if (!stringValue(snapshot.organizationName) || !stringValue(snapshot.customerName)) return false;

  if (document.kind === "payment_schedule") {
    return scheduleRows(payload.schedule).length > 0
      && positiveNumber(payload.principal)
      && positiveInteger(payload.termMonths)
      && Boolean(dateValue(payload.issueDate) || dateValue(snapshot.issuedAt) || dateValue(document.issued_on));
  }

  if (document.kind === "capital_payment_record") {
    const details = asRecord(payload.details);
    return positiveNumber(details.capitalPayment)
      && nonNegativeNumber(details.currentCapital)
      && nonNegativeNumber(details.newCapital)
      && Boolean(dateValue(details.transactionDate) || dateValue(snapshot.issuedAt) || dateValue(document.issued_on));
  }

  if (document.kind === "payment_adjustment_record") {
    const adjustment = asRecord(payload.adjustment);
    return positiveInteger(adjustment.paymentNumber)
      && positiveNumber(adjustment.scheduledPayment)
      && nonNegativeNumber(adjustment.receivedPayment)
      && Boolean(dateValue(payload.paymentDate) || dateValue(snapshot.issuedAt) || dateValue(document.issued_on));
  }

  return false;
}

function adjustmentValue(value: unknown): PaymentCreditAdjustment {
  const adjustment = asRecord(value);
  return {
    paymentNumber: integerValue(adjustment.paymentNumber),
    nextPaymentNumber: integerValue(adjustment.nextPaymentNumber),
    followingPaymentNumber: integerValue(adjustment.followingPaymentNumber),
    scheduledPayment: numberValue(adjustment.scheduledPayment),
    receivedPayment: numberValue(adjustment.receivedPayment),
    creditBalance: numberValue(adjustment.creditBalance),
    adjustedNextPayment: numberValue(adjustment.adjustedNextPayment),
    regularPaymentAfterAdjustment: numberValue(adjustment.regularPaymentAfterAdjustment),
  };
}

function scheduleRows(value: unknown): PaymentScheduleRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = asRecord(item);
    return {
      paymentNumber: integerValue(row.paymentNumber),
      dueDate: dateValue(row.dueDate),
      principal: numberValue(row.principal),
      interest: numberValue(row.interest),
      payment: numberValue(row.payment),
      remainingPrincipal: numberValue(row.remainingPrincipal),
    };
  });
}

function sumRows(rows: PaymentScheduleRow[], key: "interest" | "payment") {
  return rows.reduce((sum, row) => sum + row[key], 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function dateValue(value: unknown) {
  return stringValue(value).slice(0, 10);
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integerValue(value: unknown) {
  const number = numberValue(value);
  return Number.isInteger(number) ? number : 0;
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function nonNegativeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}
