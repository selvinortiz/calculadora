import type { PaymentScheduleRow } from "./finance";

export const PAYMENT_ROWS_PER_PAGE = 24;

export function paginatePaymentScheduleRows(
  rows: PaymentScheduleRow[],
  rowsPerPage = PAYMENT_ROWS_PER_PAGE,
): PaymentScheduleRow[][] {
  if (!Number.isInteger(rowsPerPage) || rowsPerPage < 1) {
    throw new RangeError("rowsPerPage must be a positive integer.");
  }

  if (rows.length === 0) return [[]];

  const pages: PaymentScheduleRow[][] = [];
  for (let index = 0; index < rows.length; index += rowsPerPage) {
    pages.push(rows.slice(index, index + rowsPerPage));
  }
  return pages;
}
