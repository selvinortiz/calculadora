import Decimal from "decimal.js";

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

  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
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

  const principalValue = new Decimal(principal);
  const exactInterest = principalValue
    .mul(new Decimal(annualRate).div(100))
    .mul(new Decimal(months).div(12));
  const total = roundCurrency(principalValue.add(exactInterest).toNumber());
  const monthly = roundCurrency(principalValue.add(exactInterest).div(months).toNumber());
  const finalPayment = roundCurrency(
    new Decimal(total).minus(new Decimal(monthly).mul(months - 1)).toNumber(),
  );

  return {
    months,
    principal: roundCurrency(principal),
    interestTotal: roundCurrency(new Decimal(total).minus(principalValue).toNumber()),
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
  const principalCents = toIntegerCents(principal);
  const interestCents = toIntegerCents(interestTotal);
  const totalCents = principalCents + interestCents;
  const regularPaymentCents = divideCentsHalfUp(totalCents, months);
  const finalPaymentCents = totalCents - regularPaymentCents * (months - 1);
  const regularPrincipalCents = divideCentsHalfUp(principalCents, months);
  let principalPaidCents = 0;
  let interestPaidCents = 0;

  return Array.from({ length: months }, (_, index) => {
    const isLast = index === months - 1;
    const paymentCents = isLast ? finalPaymentCents : regularPaymentCents;
    const principalPortionCents = isLast
      ? principalCents - principalPaidCents
      : regularPrincipalCents;
    const interestPortionCents = isLast
      ? interestCents - interestPaidCents
      : paymentCents - principalPortionCents;

    principalPaidCents += principalPortionCents;
    interestPaidCents += interestPortionCents;

    return {
      paymentNumber: firstPaymentNumber + index,
      dueDate: addMonthsToIsoDate(firstDate, index),
      principal: fromIntegerCents(principalPortionCents),
      interest: fromIntegerCents(interestPortionCents),
      payment: fromIntegerCents(paymentCents),
      remainingPrincipal: fromIntegerCents(Math.max(0, principalCents - principalPaidCents)),
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

  const scheduledCents = toIntegerCents(scheduledPayment);
  const receivedCents = toIntegerCents(receivedPayment);
  const creditCents = receivedCents - scheduledCents;
  if (creditCents >= scheduledCents) {
    throw new RangeError(
      "The credit balance must be smaller than the next scheduled installment.",
    );
  }

  return {
    paymentNumber,
    nextPaymentNumber: paymentNumber + 1,
    followingPaymentNumber: paymentNumber + 2,
    scheduledPayment: fromIntegerCents(scheduledCents),
    receivedPayment: fromIntegerCents(receivedCents),
    creditBalance: fromIntegerCents(creditCents),
    adjustedNextPayment: fromIntegerCents(scheduledCents - creditCents),
    regularPaymentAfterAdjustment: fromIntegerCents(scheduledCents),
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

  const principalDecimal = new Decimal(principal);
  const annualRateDecimal = new Decimal(annualRate).div(100);
  const originalInterest = principalDecimal.mul(annualRateDecimal).mul(new Decimal(totalMonths).div(12));
  const exactRegularPayment = principalDecimal.add(originalInterest).div(totalMonths);
  const principalPerPayment = principalDecimal.div(totalMonths);
  const interestPerPayment = originalInterest.div(totalMonths);
  const remainingMonths = totalMonths - applyAfterPayment;
  const calculatedCurrentCapital = principalDecimal.minus(principalPerPayment.mul(applyAfterPayment));
  const exactCurrentCapital = currentCapital === undefined ? calculatedCurrentCapital : new Decimal(currentCapital);

  if (new Decimal(capitalPayment).greaterThan(exactCurrentCapital)) {
    throw new RangeError("The capital payment cannot exceed the current capital.");
  }

  const exactNewCapital = Decimal.max(0, exactCurrentCapital.minus(capitalPayment));
  const remainingYearFraction = new Decimal(remainingMonths).div(12);
  const originalFutureInterest = originalInterest.mul(new Decimal(remainingMonths).div(totalMonths));
  const recalculatedInterestBeforeCapitalPayment = exactCurrentCapital.mul(annualRateDecimal).mul(remainingYearFraction);
  const newFutureInterest = exactNewCapital.mul(annualRateDecimal).mul(remainingYearFraction);
  const originalScheduledBalance = exactCurrentCapital.add(originalFutureInterest);
  const newScheduledBalance = exactNewCapital.add(newFutureInterest);
  const roundedNewScheduledBalance = roundDecimalCurrency(newScheduledBalance);
  const newMonthlyPayment = roundDecimalCurrency(newScheduledBalance.div(remainingMonths));
  const newFinalPayment = roundDecimalCurrency(new Decimal(roundedNewScheduledBalance).minus(new Decimal(newMonthlyPayment).mul(remainingMonths - 1)));

  return {
    applyAfterPayment,
    remainingMonths,
    regularPayment: roundDecimalCurrency(exactRegularPayment),
    paymentThisMonth: roundDecimalCurrency(exactRegularPayment.add(capitalPayment)),
    principalAppliedByRegularPayment: roundDecimalCurrency(principalPerPayment),
    interestAppliedByRegularPayment: roundDecimalCurrency(interestPerPayment),
    currentCapital: roundDecimalCurrency(exactCurrentCapital),
    newCapital: roundDecimalCurrency(exactNewCapital),
    originalFutureInterest: roundDecimalCurrency(originalFutureInterest),
    interestAdjustmentFromRecalculation: roundDecimalCurrency(originalFutureInterest.minus(recalculatedInterestBeforeCapitalPayment)),
    interestReductionFromCapitalPayment: roundDecimalCurrency(recalculatedInterestBeforeCapitalPayment.minus(newFutureInterest)),
    newFutureInterest: roundDecimalCurrency(newFutureInterest),
    originalScheduledBalance: roundDecimalCurrency(originalScheduledBalance),
    newScheduledBalance: roundedNewScheduledBalance,
    totalInterestReduction: roundDecimalCurrency(originalFutureInterest.minus(newFutureInterest)),
    newMonthlyPayment,
    newFinalPayment,
  };
}

function toIntegerCents(value: number): number {
  return new Decimal(value).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

function fromIntegerCents(value: number): number {
  return new Decimal(value).div(100).toNumber();
}

function divideCentsHalfUp(cents: number, divisor: number): number {
  return new Decimal(cents).div(divisor).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

function roundDecimalCurrency(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
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
