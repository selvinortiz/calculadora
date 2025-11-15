"use client";

import { useMemo, useState } from "react";

type TermRow = {
  years: number;
  principal: number;
  interestTotal: number;
  total: number;
  monthly: number;
};

function formatQ(value: number) {
  if (isNaN(value)) return "Q0.00";
  return (
    "Q" +
    value.toLocaleString("es-GT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// Amortized loan formula: M = P × [r(1+r)^n] / [(1+r)^n - 1]
// where M = monthly payment, P = principal, r = monthly rate, n = number of months
function calculateAmortizedPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return principal / months;

  const monthlyRate = annualRate / 100 / 12;
  const numerator = monthlyRate * Math.pow(1 + monthlyRate, months);
  const denominator = Math.pow(1 + monthlyRate, months) - 1;

  return principal * (numerator / denominator);
}

export default function AmortizedCalculator() {
  const [price, setPrice] = useState<number>(65000);
  const [downPayment, setDownPayment] = useState<number>(3000);
  const [rate, setRate] = useState<number>(7);
  const [highlightTerm, setHighlightTerm] = useState<number>(2);

  const principal = Math.max(price - downPayment, 0);

  const rows: TermRow[] = useMemo(() => {
    const result: TermRow[] = [];
    for (let years = 1; years <= 5; years++) {
      const months = years * 12;
      const monthly = calculateAmortizedPayment(principal, rate, months);
      const total = monthly * months;
      const interestTotal = total - principal;

      result.push({
        years,
        principal,
        interestTotal,
        total,
        monthly,
      });
    }
    return result;
  }, [principal, rate]);

  return (
    <main style={styles.page} className="calculator-page">
      <div style={styles.card} className="calculator-card">
        <h1 style={styles.title} className="calculator-title">Calculadora de Pagos Amortizados</h1>
        <p style={styles.subtitle} className="calculator-subtitle">
          Usa interés compuesto amortizado. Todos los montos están en quetzales (Q).
        </p>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="price" className="calculator-label">
              Precio total
            </label>
            <input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              style={styles.input}
              className="calculator-input"
            />
            <small style={styles.hint} className="calculator-hint">Ejemplo: 65000</small>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="downPayment" className="calculator-label">
              Enganche
            </label>
            <input
              id="downPayment"
              type="number"
              value={downPayment}
              onChange={(e) =>
                setDownPayment(parseFloat(e.target.value) || 0)
              }
              style={styles.input}
              className="calculator-input"
            />
            <small style={styles.hint} className="calculator-hint">Ejemplo: 3000 o 10000</small>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="rate" className="calculator-label">
              Interés anual (%)
            </label>
            <input
              id="rate"
              type="number"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
              style={styles.input}
              className="calculator-input"
            />
            <small style={styles.hint} className="calculator-hint">Ejemplo: 7</small>
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="term" className="calculator-label">
              Plazo a resaltar (años)
            </label>
            <select
              id="term"
              value={highlightTerm}
              onChange={(e) => setHighlightTerm(parseInt(e.target.value, 10))}
              style={styles.input}
              className="calculator-input"
            >
              <option value={1}>1 año</option>
              <option value={2}>2 años</option>
              <option value={3}>3 años</option>
              <option value={4}>4 años</option>
              <option value={5}>5 años</option>
            </select>
            <small style={styles.hint} className="calculator-hint">La tabla muestra 1–5 años</small>
          </div>
        </div>

        <div style={styles.summary} className="calculator-summary">
          <strong>Precio:</strong> {formatQ(price)} ·{" "}
          <strong>Enganche:</strong> {formatQ(downPayment)} ·{" "}
          <strong>Saldo financiado:</strong> {formatQ(principal)} ·{" "}
          <strong>Interés:</strong> {rate.toFixed(2)}% anual
        </div>

        <div style={styles.tableWrapper} className="calculator-table-wrapper">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, textAlign: "left" }} className="calculator-th">Plazo</th>
                <th style={styles.th} className="calculator-th">Principal</th>
                <th style={styles.th} className="calculator-th">Interés total</th>
                <th style={styles.th} className="calculator-th">Total a pagar</th>
                <th style={styles.th} className="calculator-th">Pago mensual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const highlight = row.years === highlightTerm;
                return (
                  <tr
                    key={row.years}
                    style={{
                      ...styles.tr,
                      ...(highlight ? styles.trHighlight : {}),
                    }}
                    className={`calculator-tr ${highlight ? "calculator-tr-highlight" : ""}`}
                  >
                    <td style={{ ...styles.td, textAlign: "left" }} className="calculator-td">
                      {row.years} año{row.years > 1 ? "s" : ""}
                    </td>
                    <td style={styles.td} className="calculator-td">{formatQ(row.principal)}</td>
                    <td style={styles.td} className="calculator-td">{formatQ(row.interestTotal)}</td>
                    <td style={styles.td} className="calculator-td">{formatQ(row.total)}</td>
                    <td style={styles.td} className="calculator-td">{formatQ(row.monthly)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p style={styles.support} className="calculator-support">
          💡 Fórmula amortizada: Pago mensual = P × [r(1+r)^n] / [(1+r)^n - 1],
          donde P = principal, r = tasa mensual (anual ÷ 12 ÷ 100), n = número de meses.
          El interés se calcula sobre el saldo pendiente cada mes.
        </p>

        <p style={styles.support} className="calculator-support">
            📞 Este proyecto fue creado por <b>Selvin Ortiz</b>. Si tiene preguntas o sugerencias,
            <a
                href="https://wa.me/16128078475?text=Hola%2C%20necesito%20ayuda%20con%20la%20calculadora."
                target="_blank"
                rel="noopener noreferrer"
                style={styles.whatsappLink}
            >
                escríbame por WhatsApp
            </a>
            .
        </p>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    margin: 0,
    padding: "2rem",
    background: "#f5f5f7",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  card: {
    maxWidth: "960px",
    width: "100%",
    background: "#ffffff",
    borderRadius: "1rem",
    boxShadow: "0 15px 30px rgba(15, 23, 42, 0.08)",
    padding: "1.75rem 2rem 2.25rem",
  },
  title: {
    margin: 0,
    marginBottom: "0.5rem",
    fontSize: "1.6rem",
    fontWeight: 700,
    color: "#111827",
  },
  subtitle: {
    margin: 0,
    marginBottom: "1.5rem",
    fontSize: "0.95rem",
    color: "#6b7280",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.9rem",
  },
  label: {
    fontWeight: 600,
    color: "#374151",
  },
  hint: {
    fontSize: "0.75rem",
    color: "#9ca3af",
  },
  input: {
    borderRadius: "0.5rem",
    border: "1px solid #d1d5db",
    padding: "0.45rem 0.55rem",
    fontSize: "0.9rem",
    outline: "none",
    backgroundColor: "#f9fafb",
  },
  summary: {
    marginBottom: "1rem",
    padding: "0.75rem 0.9rem",
    borderRadius: "0.75rem",
    background: "#f3f4ff",
    border: "1px solid #e0e7ff",
    fontSize: "0.9rem",
    color: "#4338ca",
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "0.5rem",
    fontSize: "0.88rem",
  },
  th: {
    padding: "0.55rem 0.6rem",
    textAlign: "right",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 600,
    color: "#4b5563",
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #e5e7eb",
  },
  trHighlight: {
    background: "#eef2ff",
    fontWeight: 600,
    color: "#3730a3",
  },
  td: {
    padding: "0.55rem 0.6rem",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  note: {
    marginTop: "0.75rem",
    fontSize: "0.8rem",
    color: "#6b7280",
  },
  support: {
    marginTop: "1.25rem",
    fontSize: "0.85rem",
    color: "#374151",
    textAlign: "center",
  },

  whatsappLink: {
    color: "#25D366",
    fontWeight: 600,
    textDecoration: "none",
    marginLeft: "0.25rem",
  },
};
