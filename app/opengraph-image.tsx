import { ImageResponse } from "next/og";
import { getSiteUrl, SITE_NAME } from "@/lib/site-metadata";

export const alt =
  "Calculadora de Créditos, portal de interés simple para prestamistas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 52%, #ecfdf5 100%)",
          color: "#111827",
          display: "flex",
          fontFamily: "Arial, Helvetica, sans-serif",
          height: "100%",
          padding: 48,
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#4f46e5",
            borderRadius: 999,
            height: 320,
            opacity: 0.1,
            position: "absolute",
            right: -85,
            top: -120,
            width: 320,
          }}
        />
        <div
          style={{
            background: "#047857",
            borderRadius: 999,
            bottom: -120,
            height: 280,
            left: -90,
            opacity: 0.08,
            position: "absolute",
            width: 280,
          }}
        />

        <div
          style={{
            background: "rgba(255, 255, 255, 0.9)",
            border: "1px solid #dbe2ee",
            borderRadius: 32,
            boxShadow: "0 24px 70px rgba(30, 41, 59, 0.12)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "46px 52px",
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div style={{ alignItems: "center", display: "flex" }}>
              <div
                style={{
                  alignItems: "center",
                  background: "#4f46e5",
                  borderRadius: 16,
                  boxShadow: "0 10px 24px rgba(79, 70, 229, 0.28)",
                  color: "white",
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 800,
                  height: 64,
                  justifyContent: "center",
                  marginRight: 18,
                  width: 64,
                }}
              >
                Q
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 28, fontWeight: 800 }}>{SITE_NAME}</span>
                <span style={{ color: "#64748b", fontSize: 18, marginTop: 3 }}>
                  Interés simple para prestamistas
                </span>
              </div>
            </div>
            <div
              style={{
                background: "#eef2ff",
                border: "1px solid #c7d2fe",
                borderRadius: 999,
                color: "#3730a3",
                display: "flex",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: 1,
                padding: "12px 18px",
                textTransform: "uppercase",
              }}
            >
              Portal para prestamistas
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
            <span
              style={{
                fontSize: 62,
                fontWeight: 850,
                letterSpacing: -2.5,
                lineHeight: 1.04,
                maxWidth: 930,
              }}
            >
              Créditos simples. Pagos bien documentados.
            </span>
            <span
              style={{
                color: "#475569",
                fontSize: 25,
                lineHeight: 1.35,
                marginTop: 22,
                maxWidth: 950,
              }}
            >
              Cotiza préstamos, registra abonos a capital y entrega recibos y planes de pago listos para imprimir.
            </span>
          </div>

          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex" }}>
              {['Interés simple', 'Quetzales', 'Documentos claros'].map((label) => (
                <span
                  key={label}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #dbe2ee",
                    borderRadius: 999,
                    color: "#334155",
                    display: "flex",
                    fontSize: 17,
                    fontWeight: 700,
                    marginRight: 10,
                    padding: "10px 15px",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
            <span style={{ color: "#64748b", fontSize: 17 }}>
              {getSiteUrl().hostname}
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
