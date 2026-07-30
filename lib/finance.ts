export const LOAN_LIMITS = {
  price: { min: 0, max: 1_000_000_000 },
  annualRate: { min: 0, max: 100 },
} as const;

export type LoanInputs = {
  price: number;
  downPayment: number;
  annualRate: number;
};

export type LoanInputErrors = Partial<Record<keyof LoanInputs, string>>;

export type TermRow = {
  years: number;
  months: number;
  principal: number;
  interestTotal: number;
  total: number;
  monthly: number;
  finalPayment: number;
};

export type SimpleInterestQuote = {
  months: number;
  principal: number;
  interestTotal: number;
  total: number;
  monthly: number;
  finalPayment: number;
};

export type SimpleInterestRecalculationInputs = {
  principal: number;
  annualRate: number;
  totalMonths: number;
  applyAfterPayment: number;
  capitalPayment: number;
  currentCapital?: number;
};

export type SimpleInterestRecalculation = {
  applyAfterPayment: number;
  remainingMonths: number;
  regularPayment: number;
  paymentThisMonth: number;
  principalAppliedByRegularPayment: number;
  interestAppliedByRegularPayment: number;
  currentCapital: number;
  newCapital: number;
  originalFutureInterest: number;
  interestAdjustmentFromRecalculation: number;
  interestReductionFromCapitalPayment: number;
  newFutureInterest: number;
  originalScheduledBalance: number;
  newScheduledBalance: number;
  totalInterestReduction: number;
  newMonthlyPayment: number;
  newFinalPayment: number;
};

export type PaymentScheduleInputs = {
  principal: number;
  interestTotal: number;
  months: number;
  firstDueDate: string;
  firstPaymentNumber?: number;
};

export type PaymentScheduleRow = {
  paymentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  payment: number;
  remainingPrincipal: number;
};

export type PaymentCreditAdjustmentInputs = {
  paymentNumber: number;
  scheduledPayment: number;
  receivedPayment: number;
};

export type PaymentCreditAdjustment = {
  paymentNumber: number;
  nextPaymentNumber: number;
  followingPaymentNumber: number;
  scheduledPayment: number;
  receivedPayment: number;
  creditBalance: number;
  adjustedNextPayment: number;
  regularPaymentAfterAdjustment: number;
};

export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Currency values must be finite.");
  }

  return Math.round(value * 100) / 100;
}

export function validateLoanInputs(inputs: LoanInputs): LoanInputErrors {
  const errors: LoanInputErrors = {};

  if (!Number.isFinite(inputs.price)) {
    errors.price = "Ingresa un precio válido.";
  } else if (inputs.price < LOAN_LIMITS.price.min) {
    errors.price = "El precio no puede ser negativo.";
  } else if (inputs.price > LOAN_LIMITS.price.max) {
    errors.price = "El precio excede el máximo permitido.";
  } else if (!hasCentPrecision(inputs.price)) {
    errors.price = "Usa como máximo dos decimales para el precio.";
  }

  if (!Number.isFinite(inputs.downPayment)) {
    errors.downPayment = "Ingresa un enganche válido.";
  } else if (inputs.downPayment < 0) {
    errors.downPayment = "El enganche no puede ser negativo.";
  } else if (!hasCentPrecision(inputs.downPayment)) {
    errors.downPayment = "Usa como máximo dos decimales para el enganche.";
  } else if (!errors.price && inputs.downPayment > inputs.price) {
    errors.downPayment = "El enganche no puede superar el precio.";
  }

  if (!Number.isFinite(inputs.annualRate)) {
    errors.annualRate = "Ingresa una tasa válida.";
  } else if (inputs.annualRate < LOAN_LIMITS.annualRate.min) {
    errors.annualRate = "La tasa no puede ser negativa.";
  } else if (inputs.annualRate > LOAN_LIMITS.annualRate.max) {
    errors.annualRate = "La tasa no puede superar el 100%.";
  }

  return errors;
}

export function calculateSimpleInterestQuote(
  principal: number,
  annualRate: number,
  months: number,
): SimpleInterestQuote {
  assertCalculationInputs(principal, annualRate, months);

  const exactInterest = principal * (annualRate / 100) * (months / 12);
  const total = roundCurrency(principal + exactInterest);
  const monthly = roundCurrency((principal + exactInterest) / months);
  const finalPayment = roundCurrency(total - monthly * (months - 1));

  return {
    months,
    principal: roundCurrency(principal),
    interestTotal: roundCurrency(total - principal),
    total,
    monthly,
    finalPayment,
  };
}

export function calculateTermRows(
  principal: number,
  annualRate: number,
): TermRow[] {
  assertCalculationInputs(principal, annualRate, 1);

  return Array.from({ length: 5 }, (_, index) => {
    const years = index + 1;
    const months = years * 12;
    const quote = calculateSimpleInterestQuote(principal, annualRate, months);

    return {
      years,
      ...quote,
    };
  });
}

export function calculatePaymentSchedule({
  principal,
  interestTotal,
  months,
  firstDueDate,
  firstPaymentNumber = 1,
}: PaymentScheduleInputs): PaymentScheduleRow[] {
  assertCalculationInputs(principal, 0, months);
  if (!Number.isFinite(interestTotal) || interestTotal < 0) {
    throw new RangeError("Total interest must be a finite, non-negative number.");
  }
  if (!hasCentPrecision(principal) || !hasCentPrecision(interestTotal)) {
    throw new RangeError("Schedule totals must use at most two decimals.");
  }
  if (!Number.isInteger(firstPaymentNumber) || firstPaymentNumber <= 0) {
    throw new RangeError("The first payment number must be a positive integer.");
  }

  const firstDate = parseIsoDate(firstDueDate);
  const total = roundCurrency(principal + interestTotal);
  const regularPayment = roundCurrency(total / months);
  const finalPayment = roundCurrency(
    total - regularPayment * (months - 1),
  );
  const regularPrincipal = roundCurrency(principal / months);
  let principalPaid = 0;
  let interestPaid = 0;

  return Array.from({ length: months }, (_, index) => {
    const isLast = index === months - 1;
    const payment = isLast ? finalPayment : regularPayment;
    const principalPortion = isLast
      ? roundCurrency(principal - principalPaid)
      : regularPrincipal;
    const interestPortion = isLast
      ? roundCurrency(interestTotal - interestPaid)
      : roundCurrency(payment - principalPortion);

    principalPaid = roundCurrency(principalPaid + principalPortion);
    interestPaid = roundCurrency(interestPaid + interestPortion);

    return {
      paymentNumber: firstPaymentNumber + index,
      dueDate: addMonthsToIsoDate(firstDate, index),
      principal: principalPortion,
      interest: interestPortion,
      payment,
      remainingPrincipal: roundCurrency(Math.max(0, principal - principalPaid)),
    };
  });
}

/**
 * Applies an excess received with one installment to the immediately following
 * installment. This records an advance against that installment; it does not
 * change capital, interest, the recurring payment, or the agreement end date.
 */
export function calculatePaymentCreditAdjustment({
  paymentNumber,
  scheduledPayment,
  receivedPayment,
}: PaymentCreditAdjustmentInputs): PaymentCreditAdjustment {
  if (!Number.isInteger(paymentNumber) || paymentNumber <= 0) {
    throw new RangeError("The payment number must be a positive integer.");
  }
  if (
    !Number.isFinite(scheduledPayment) ||
    scheduledPayment <= 0 ||
    !hasCentPrecision(scheduledPayment)
  ) {
    throw new RangeError(
      "The scheduled payment must be positive and use at most two decimals.",
    );
  }
  if (
    !Number.isFinite(receivedPayment) ||
    receivedPayment <= scheduledPayment ||
    !hasCentPrecision(receivedPayment)
  ) {
    throw new RangeError(
      "The received payment must exceed the scheduled payment and use at most two decimals.",
    );
  }

  const creditBalance = roundCurrency(receivedPayment - scheduledPayment);
  if (creditBalance >= scheduledPayment) {
    throw new RangeError(
      "The credit balance must be smaller than the next scheduled installment.",
    );
  }

  return {
    paymentNumber,
    nextPaymentNumber: paymentNumber + 1,
    followingPaymentNumber: paymentNumber + 2,
    scheduledPayment: roundCurrency(scheduledPayment),
    receivedPayment: roundCurrency(receivedPayment),
    creditBalance,
    adjustedNextPayment: roundCurrency(scheduledPayment - creditBalance),
    regularPaymentAfterAdjustment: roundCurrency(scheduledPayment),
  };
}

/**
 * Recalculates a flat/simple-interest agreement after a regular installment and
 * an additional capital payment. The remaining interest is calculated from the
 * new capital, the original annual rate, and the time left in the agreement.
 */
export function calculateSimpleInterestRecalculation({
  principal,
  annualRate,
  totalMonths,
  applyAfterPayment,
  capitalPayment,
  currentCapital,
}: SimpleInterestRecalculationInputs): SimpleInterestRecalculation {
  assertCalculationInputs(principal, annualRate, totalMonths);

  if (
    !Number.isInteger(applyAfterPayment) ||
    applyAfterPayment <= 0 ||
    applyAfterPayment >= totalMonths
  ) {
    throw new RangeError(
      "The payment number must leave at least one installment remaining.",
    );
  }
  if (!Number.isFinite(capitalPayment) || capitalPayment <= 0) {
    throw new RangeError("The capital payment must be a finite, positive number.");
  }
  if (!hasCentPrecision(capitalPayment)) {
    throw new RangeError("The capital payment must use at most two decimals.");
  }
  if (
    currentCapital !== undefined &&
    (!Number.isFinite(currentCapital) ||
      currentCapital < 0 ||
      currentCapital > principal ||
      !hasCentPrecision(currentCapital))
  ) {
    throw new RangeError(
      "The current capital must be between zero and the original principal and use at most two decimals.",
    );
  }

  const annualRateDecimal = annualRate / 100;
  const originalInterest =
    principal * annualRateDecimal * (totalMonths / 12);
  const exactRegularPayment = (principal + originalInterest) / totalMonths;
  const principalPerPayment = principal / totalMonths;
  const interestPerPayment = originalInterest / totalMonths;
  const remainingMonths = totalMonths - applyAfterPayment;
  const calculatedCurrentCapital =
    principal - principalPerPayment * applyAfterPayment;
  const exactCurrentCapital = currentCapital ?? calculatedCurrentCapital;

  if (capitalPayment - exactCurrentCapital > 1e-7) {
    throw new RangeError("The capital payment cannot exceed the current capital.");
  }

  const exactNewCapital = Math.max(0, exactCurrentCapital - capitalPayment);
  const originalFutureInterest =
    originalInterest * (remainingMonths / totalMonths);
  const recalculatedInterestBeforeCapitalPayment =
    exactCurrentCapital * annualRateDecimal * (remainingMonths / 12);
  const newFutureInterest =
    exactNewCapital * annualRateDecimal * (remainingMonths / 12);
  const originalScheduledBalance =
    exactCurrentCapital + originalFutureInterest;
  const newScheduledBalance = exactNewCapital + newFutureInterest;
  const roundedNewScheduledBalance = roundCurrency(newScheduledBalance);
  const newMonthlyPayment = roundCurrency(
    newScheduledBalance / remainingMonths,
  );
  const newFinalPayment = roundCurrency(
    roundedNewScheduledBalance - newMonthlyPayment * (remainingMonths - 1),
  );

  return {
    applyAfterPayment,
    remainingMonths,
    regularPayment: roundCurrency(exactRegularPayment),
    paymentThisMonth: roundCurrency(exactRegularPayment + capitalPayment),
    principalAppliedByRegularPayment: roundCurrency(principalPerPayment),
    interestAppliedByRegularPayment: roundCurrency(interestPerPayment),
    currentCapital: roundCurrency(exactCurrentCapital),
    newCapital: roundCurrency(exactNewCapital),
    originalFutureInterest: roundCurrency(originalFutureInterest),
    interestAdjustmentFromRecalculation: roundCurrency(
      originalFutureInterest - recalculatedInterestBeforeCapitalPayment,
    ),
    interestReductionFromCapitalPayment: roundCurrency(
      recalculatedInterestBeforeCapitalPayment - newFutureInterest,
    ),
    newFutureInterest: roundCurrency(newFutureInterest),
    originalScheduledBalance: roundCurrency(originalScheduledBalance),
    newScheduledBalance: roundedNewScheduledBalance,
    totalInterestReduction: roundCurrency(
      originalFutureInterest - newFutureInterest,
    ),
    newMonthlyPayment,
    newFinalPayment,
  };
}

function assertCalculationInputs(
  principal: number,
  annualRate: number,
  months: number,
) {
  if (!Number.isFinite(principal) || principal < 0) {
    throw new RangeError("Principal must be a finite, non-negative number.");
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    throw new RangeError("Annual rate must be a finite, non-negative number.");
  }
  if (!Number.isInteger(months) || months <= 0) {
    throw new RangeError("Months must be a positive integer.");
  }
}

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("The due date must use YYYY-MM-DD format.");

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("The due date must be a valid calendar date.");
  }

  return { year, month, day };
}

function addMonthsToIsoDate(
  firstDate: { year: number; month: number; day: number },
  offset: number,
): string {
  const monthIndex = firstDate.month - 1 + offset;
  const targetYear = firstDate.year + Math.floor(monthIndex / 12);
  const targetMonthIndex = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonthIndex + 1, 0),
  ).getUTCDate();
  const day = Math.min(firstDate.day, lastDay);

  return [
    String(targetYear).padStart(4, "0"),
    String(targetMonthIndex + 1).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function hasCentPrecision(value: number): boolean {
  return Math.abs(roundCurrency(value) - value) < 1e-7;
}
