import { describe, expect, it } from "vitest";
import { calculatePaymentSchedule } from "./finance";
import {
  PAYMENT_ROWS_PER_PAGE,
  paginatePaymentScheduleRows,
} from "./print-layout";

describe("paginatePaymentScheduleRows", () => {
  it("uses 24 payments per printable sheet", () => {
    const rows = createSchedule(60);
    const pages = paginatePaymentScheduleRows(rows);

    expect(PAYMENT_ROWS_PER_PAGE).toBe(24);
    expect(pages.map((page) => page.length)).toEqual([24, 24, 12]);
    expect(pages.map((page) => page[0]?.paymentNumber)).toEqual([1, 25, 49]);
    expect(pages.flat()).toEqual(rows);
  });

  it("keeps updated payment numbers across page boundaries", () => {
    const rows = calculatePaymentSchedule({
      principal: 39_933.33,
      interestTotal: 12_346.06,
      months: 53,
      firstDueDate: "2026-08-20",
      firstPaymentNumber: 8,
    });
    const pages = paginatePaymentScheduleRows(rows);

    expect(pages.map((page) => page.length)).toEqual([24, 24, 5]);
    expect(pages.map((page) => page[0]?.paymentNumber)).toEqual([8, 32, 56]);
    expect(pages.at(-1)?.at(-1)?.paymentNumber).toBe(60);
  });

  it("returns one empty sheet and rejects invalid page sizes", () => {
    expect(paginatePaymentScheduleRows([])).toEqual([[]]);
    expect(() => paginatePaymentScheduleRows(createSchedule(12), 0)).toThrow(
      RangeError,
    );
  });
});

function createSchedule(months: number) {
  return calculatePaymentSchedule({
    principal: 52_000,
    interestTotal: 18_200,
    months,
    firstDueDate: "2026-08-20",
  });
}
