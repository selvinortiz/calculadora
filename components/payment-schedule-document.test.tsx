import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculatePaymentSchedule } from "../lib/finance";
import { PaymentScheduleDocument } from "./payment-schedule-document";

describe("PaymentScheduleDocument", () => {
  it("renders a 60-payment plan as three intentional print pages", () => {
    const rows = calculatePaymentSchedule({
      principal: 52_000,
      interestTotal: 18_200,
      months: 60,
      firstDueDate: "2026-08-20",
    });
    const markup = renderToStaticMarkup(
      <PaymentScheduleDocument
        accountReference="Lote 39"
        annualRate={7}
        creditorName="Créditos del Lago"
        debtorName="María Ortiz"
        downPayment={13_000}
        finalPayment={1_170}
        interestTotal={18_200}
        issueDate="2026-07-27"
        monthlyPayment={1_170}
        originalTermMonths={60}
        price={65_000}
        principal={52_000}
        rows={rows}
        scheduledTotal={70_200}
        variant="original"
      />,
    );

    expect(markup.match(/data-print-page=/g)).toHaveLength(3);
    expect(markup).toContain("Cuotas 1–24");
    expect(markup).toContain("Cuotas 25–48");
    expect(markup).toContain("Cuotas 49–60");
    expect(markup.match(/Totales/g)).toHaveLength(1);
    expect(markup.match(/Condiciones de este plan/g)).toHaveLength(1);
    expect(markup).toContain("Página 3 de 3");
  });
});
