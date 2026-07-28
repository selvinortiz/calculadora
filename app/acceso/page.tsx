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
            <p>Portal para prestamistas</p>
            <h1>Créditos y pagos, en orden.</h1>
            <span>
              Cotiza préstamos, registra abonos y entrega documentos claros.
            </span>
          </div>
          <ul>
            <li>Cotizar</li>
            <li>Recalcular</li>
            <li>Imprimir</li>
          </ul>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.formHeading}>
            <p>Acceso seguro</p>
            <h2>Iniciar sesión</h2>
            <span>Ingresa tu correo y código de acceso.</span>
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
