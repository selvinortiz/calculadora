import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculatePaymentCreditAdjustment } from "../lib/finance";
import { PaymentAdjustmentRecord } from "./payment-adjustment-record";

describe("PaymentAdjustmentRecord", () => {
  it("states how the credit changes only the next amount due", () => {
    const adjustment = calculatePaymentCreditAdjustment({
      paymentNumber: 7,
      scheduledPayment: 993.56,
      receivedPayment: 1_035,
    });
    const markup = renderToStaticMarkup(
      <PaymentAdjustmentRecord
        adjustment={adjustment}
        details={{
          debtorName: "María de los Ángeles Ortiz",
          creditorName: "Lotificación El Jardín",
          accountReference: "Lote 39",
          documentNumber: "A-001",
          adjustedBy: "Oscar Herrera",
          paymentReference: "494",
          notes: "",
        }}
        issueDate="2026-07-30"
        nextPaymentDate="2026-08-30"
        paymentDate="2026-07-30"
      />,
    );

    expect(markup).toContain("Constancia de ajuste de pago");
    expect(markup).toContain("Q 41.44");
    expect(markup).toContain("Q 952.12");
    expect(markup).toContain("Desde la 9");
    expect(markup).toContain("No modifica el capital, el interés ni la fecha final");
  });
});
