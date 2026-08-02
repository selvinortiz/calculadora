import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isPostedDocumentComplete, PostedDocumentBundle, type PostedSnapshotDocument } from "./posted-document-bundle";

describe("PostedDocumentBundle", () => {
  it("rebuilds a capital-payment receipt and its explicitly paginated revised plan", () => {
    const revisedSchedule = Array.from({ length: 54 }, (_, index) => ({
      paymentNumber: index + 7,
      dueDate: "2026-08-20",
      principal: index === 53 ? 755.3 : 755.56,
      interest: index === 53 ? 237.99 : 238,
      payment: index === 53 ? 993.29 : 993.56,
      remainingPrincipal: Math.max(0, 40_799.98 - (index + 1) * 755.56),
    }));
    const document: PostedSnapshotDocument = {
      kind: "capital_payment_record",
      snapshot_version: 1,
      calculation_version: "simple-interest-v2-cents",
      issued_on: "2026-07-21",
      snapshot: {
        organizationName: "Lotificación El Jardín",
        customerName: "María Ortiz",
        accountReference: "39",
        issuedAt: "2026-07-21T00:00:00.000Z",
        payload: {
          details: {
            transactionMode: "standalone",
            paymentNumber: 6,
            transactionDate: "2026-07-21",
            lastPaymentDate: "2026-06-28",
            nextPaymentDate: "2026-08-20",
            balanceSource: "calculated",
            capitalPayment: 6_000,
            currentCapital: 46_799.98,
            newCapital: 40_799.98,
            originalFutureInterest: 16_380.02,
            newFutureInterest: 12_851.99,
            newScheduledBalance: 53_651.97,
            regularPayment: 1_170,
            paymentMethod: "Depósito",
            receivedBy: "Oscar Herrera",
          },
          revisedQuote: {
            months: 54,
            monthly: 993.56,
            finalPayment: 993.29,
            interestTotal: 12_851.99,
            total: 53_651.97,
          },
          revisedSchedule,
        },
      },
    };

    const markup = renderToStaticMarkup(
      <PostedDocumentBundle
        active
        document={document}
        documentNumber="REC-000001"
        loan={{
          price: 65_000,
          downPayment: 13_000,
          originalPrincipal: 52_000,
          annualRate: 7,
          termMonths: 60,
        }}
        printKey="transaction-1"
      />,
    );

    expect(markup).toContain("Recibo de abono a capital");
    expect(markup).toContain("Plan de pagos actualizado");
    expect(markup).toContain("Condiciones de este plan");
    expect(markup.match(/data-print-page=/g)).toHaveLength(3);
    expect(markup).toContain("Cuotas 7–30");
    expect(markup).toContain("Cuotas 31–54");
    expect(markup).toContain("Cuotas 55–60");
  });

  it("flags missing schedule snapshots instead of rendering invented zero values", () => {
    const document: PostedSnapshotDocument = {
      kind: "payment_schedule",
      snapshot_version: 1,
      calculation_version: "simple-interest-v2-cents",
      issued_on: "2026-07-31",
      snapshot: {},
    };

    const markup = renderToStaticMarkup(
      <PostedDocumentBundle
        active
        document={document}
        documentNumber="FIN-000002"
        loan={{ price: 65_000, downPayment: 13_000, originalPrincipal: 52_000, annualRate: 7, termMonths: 60 }}
        printKey="transaction-1"
      />,
    );

    expect(isPostedDocumentComplete(document)).toBe(false);
    expect(markup).toContain("Documento histórico incompleto");
    expect(markup).not.toContain("Q0.00");
    expect(markup).not.toContain("data-posted-document");
  });
});
