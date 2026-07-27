import { describe, expect, it } from "vitest";
import {
  calculatePaymentSchedule,
  calculateSimpleInterestQuote,
  calculateSimpleInterestRecalculation,
  calculateTermRows,
  roundCurrency,
  validateLoanInputs,
} from "./finance";

describe("calculatePaymentSchedule", () => {
  it("creates and reconciles a complete new-loan schedule", () => {
    const rows = calculatePaymentSchedule({
      principal: 52_000,
      interestTotal: 18_200,
      months: 60,
      firstDueDate: "2026-08-20",
    });

    expect(rows).toHaveLength(60);
    expect(rows[0]).toEqual({
      paymentNumber: 1,
      dueDate: "2026-08-20",
      principal: 866.67,
      interest: 303.33,
      payment: 1_170,
      remainingPrincipal: 51_133.33,
    });
    expect(rows.at(-1)).toMatchObject({
      paymentNumber: 60,
      dueDate: "2031-07-20",
      payment: 1_170,
      remainingPrincipal: 0,
    });
    expect(sum(rows.map((row) => row.principal))).toBe(52_000);
    expect(sum(rows.map((row) => row.interest))).toBe(18_200);
    expect(sum(rows.map((row) => row.payment))).toBe(70_200);
  });

  it("starts an updated schedule at the next unpaid installment", () => {
    const rows = calculatePaymentSchedule({
      principal: 39_933.33,
      interestTotal: 12_346.06,
      months: 53,
      firstDueDate: "2026-07-30",
      firstPaymentNumber: 8,
    });

    expect(rows[0]).toMatchObject({
      paymentNumber: 8,
      dueDate: "2026-07-30",
      payment: 986.4,
    });
    expect(rows.at(-1)).toMatchObject({
      paymentNumber: 60,
      dueDate: "2030-11-30",
      payment: 986.59,
      remainingPrincipal: 0,
    });
    expect(sum(rows.map((row) => row.principal))).toBe(39_933.33);
    expect(sum(rows.map((row) => row.interest))).toBe(12_346.06);
    expect(sum(rows.map((row) => row.payment))).toBe(52_279.39);
  });

  it("preserves the intended due day after a short month", () => {
    const rows = calculatePaymentSchedule({
      principal: 300,
      interestTotal: 0,
      months: 3,
      firstDueDate: "2027-01-31",
    });

    expect(rows.map((row) => row.dueDate)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("rejects invalid schedule inputs", () => {
    expect(() =>
      calculatePaymentSchedule({
        principal: 1_000,
        interestTotal: -1,
        months: 12,
        firstDueDate: "2026-08-20",
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculatePaymentSchedule({
        principal: 1_000,
        interestTotal: 70,
        months: 12,
        firstDueDate: "2026-02-30",
      }),
    ).toThrow(RangeError);
  });
});

describe("calculateSimpleInterestRecalculation", () => {
  it("recalculates a Q6,000 capital payment after installment 8", () => {
    const result = calculateSimpleInterestRecalculation({
      principal: 52_000,
      annualRate: 7,
      totalMonths: 60,
      applyAfterPayment: 8,
      capitalPayment: 6_000,
    });

    expect(result).toEqual({
      applyAfterPayment: 8,
      remainingMonths: 52,
      regularPayment: 1_170,
      paymentThisMonth: 7_170,
      principalAppliedByRegularPayment: 866.67,
      interestAppliedByRegularPayment: 303.33,
      currentCapital: 45_066.67,
      newCapital: 39_066.67,
      originalFutureInterest: 15_773.33,
      interestAdjustmentFromRecalculation: 2_103.11,
      interestReductionFromCapitalPayment: 1_820,
      newFutureInterest: 11_850.22,
      originalScheduledBalance: 60_840,
      newScheduledBalance: 50_916.89,
      totalInterestReduction: 3_923.11,
      newMonthlyPayment: 979.17,
      newFinalPayment: 979.22,
    });
  });

  it("uses a capital balance supplied from an account statement", () => {
    const result = calculateSimpleInterestRecalculation({
      principal: 52_000,
      annualRate: 7,
      totalMonths: 60,
      applyAfterPayment: 8,
      capitalPayment: 6_000,
      currentCapital: 44_500,
    });

    expect(result.currentCapital).toBe(44_500);
    expect(result.newCapital).toBe(38_500);
    expect(result.newFutureInterest).toBe(11_678.33);
    expect(result.newScheduledBalance).toBe(50_178.33);
  });

  it("recalculates a standalone payment after seven completed installments", () => {
    const result = calculateSimpleInterestRecalculation({
      principal: 52_000,
      annualRate: 7,
      totalMonths: 60,
      applyAfterPayment: 7,
      capitalPayment: 6_000,
    });

    expect(result.currentCapital).toBe(45_933.33);
    expect(result.newCapital).toBe(39_933.33);
    expect(result.newScheduledBalance).toBe(52_279.39);
    expect(result.newMonthlyPayment).toBe(986.4);
    expect(result.newFinalPayment).toBe(986.59);
    expect(result.remainingMonths).toBe(53);
  });

  it("handles a zero-interest agreement", () => {
    const result = calculateSimpleInterestRecalculation({
      principal: 12_000,
      annualRate: 0,
      totalMonths: 12,
      applyAfterPayment: 2,
      capitalPayment: 1_000,
    });

    expect(result.currentCapital).toBe(10_000);
    expect(result.newCapital).toBe(9_000);
    expect(result.newFutureInterest).toBe(0);
    expect(result.newMonthlyPayment).toBe(900);
  });

  it("rejects invalid payment positions and capital amounts", () => {
    const validInputs = {
      principal: 52_000,
      annualRate: 7,
      totalMonths: 60,
      applyAfterPayment: 8,
      capitalPayment: 6_000,
    };

    expect(() =>
      calculateSimpleInterestRecalculation({
        ...validInputs,
        applyAfterPayment: 60,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateSimpleInterestRecalculation({
        ...validInputs,
        capitalPayment: 60_000,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateSimpleInterestRecalculation({
        ...validInputs,
        capitalPayment: 1_000.001,
      }),
    ).toThrow(RangeError);
  });
});

describe("calculateTermRows", () => {
  it("calculates the default simple-interest example", () => {
    const [row] = calculateTermRows(62_000, 7);

    expect(row).toMatchObject({
      years: 1,
      months: 12,
      principal: 62_000,
      interestTotal: 4_340,
      total: 66_340,
      monthly: 5_528.33,
      finalPayment: 5_528.37,
    });
  });

  it("reconciles every displayed payment schedule to its displayed total", () => {
    const rows = calculateTermRows(62_000, 7);

    for (const row of rows) {
      const reconciledTotal = roundCurrency(
        row.monthly * (row.months - 1) + row.finalPayment,
      );
      expect(reconciledTotal).toBe(row.total);
    }
  });

  it("returns zero payments when the purchase is fully funded", () => {
    const rows = calculateTermRows(0, 7);

    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.total === 0 && row.monthly === 0)).toBe(
      true,
    );
  });
});

describe("calculateSimpleInterestQuote", () => {
  it("supports an arbitrary number of months", () => {
    expect(calculateSimpleInterestQuote(52_000, 7, 18)).toEqual({
      months: 18,
      principal: 52_000,
      interestTotal: 5_460,
      total: 57_460,
      monthly: 3_192.22,
      finalPayment: 3_192.26,
    });
  });

  it("rejects invalid calculation inputs", () => {
    expect(() => calculateSimpleInterestQuote(-1, 7, 12)).toThrow(RangeError);
    expect(() => calculateSimpleInterestQuote(1_000, -1, 12)).toThrow(
      RangeError,
    );
    expect(() => calculateSimpleInterestQuote(1_000, 7, 0)).toThrow(
      RangeError,
    );
  });
});

describe("validateLoanInputs", () => {
  it("accepts a valid loan", () => {
    expect(
      validateLoanInputs({
        price: 65_000,
        downPayment: 3_000,
        annualRate: 7,
      }),
    ).toEqual({});
  });

  it("rejects non-finite, negative, excessive, and overfunded values", () => {
    expect(
      validateLoanInputs({
        price: Number.NaN,
        downPayment: -1,
        annualRate: 101,
      }),
    ).toEqual({
      price: "Ingresa un precio válido.",
      downPayment: "El enganche no puede ser negativo.",
      annualRate: "La tasa no puede superar el 100%.",
    });

    expect(
      validateLoanInputs({
        price: 1_000,
        downPayment: 1_001,
        annualRate: -0.01,
      }),
    ).toEqual({
      downPayment: "El enganche no puede superar el precio.",
      annualRate: "La tasa no puede ser negativa.",
    });

    expect(
      validateLoanInputs({
        price: 1_000.001,
        downPayment: 100.001,
        annualRate: 7,
      }),
    ).toEqual({
      price: "Usa como máximo dos decimales para el precio.",
      downPayment: "Usa como máximo dos decimales para el enganche.",
    });
  });
});

function sum(values: number[]): number {
  return roundCurrency(values.reduce((total, value) => total + value, 0));
}
