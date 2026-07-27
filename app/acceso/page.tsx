import type { Metadata } from "next";
import { AccessForm } from "./access-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Acceso al portal",
  description: "Acceso para operadores autorizados del portal de créditos.",
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const { siguiente } = await searchParams;
  const nextPath = isSafePortalPath(siguiente) ? siguiente : "/";

  return (
    <main className={styles.authPage}>
      <section className={styles.authLayout}>
        <aside className={styles.contextPanel}>
          <div className={styles.brand}>
            <span aria-hidden="true">Q</span>
            <div>
              <strong>Calculadora de Créditos</strong>
              <small>Interés simple para prestamistas</small>
            </div>
          </div>
          <div className={styles.contextCopy}>
            <p>Hecha para prestamistas</p>
            <h1>Créditos claros y pagos bien documentados.</h1>
            <span>
              Calcula préstamos con interés simple, registra abonos a capital y
              entrega recibos y planes que tus clientes puedan entender.
            </span>
          </div>
          <ul>
            <li>Cotizaciones con capital, interés y cuota</li>
            <li>Recálculo de abonos a capital</li>
            <li>Recibos y planes listos para imprimir</li>
          </ul>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.formHeading}>
            <span className={styles.lockIcon} aria-hidden="true">●</span>
            <p>Portal para prestamistas</p>
            <h2>Ingresa a tu portal</h2>
            <span>Usa el correo y código de acceso que recibiste.</span>
          </div>
          <AccessForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}

function isSafePortalPath(value: string | undefined): value is string {
  return Boolean(value?.startsWith("/") && !value.startsWith("//"));
}
