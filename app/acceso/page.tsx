import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  getSiteUrl,
  PUBLIC_ENTRY_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
} from "@/lib/site-metadata";
import { AccessForm } from "./access-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: PUBLIC_ENTRY_PATH,
    languages: {
      "es-GT": PUBLIC_ENTRY_PATH,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_GT",
    url: PUBLIC_ENTRY_PATH,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Calculadora de Créditos, portal de interés simple para prestamistas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  alternateName: SITE_TITLE,
  url: new URL(PUBLIC_ENTRY_PATH, getSiteUrl()).toString(),
  description: SITE_DESCRIPTION,
  applicationCategory: "FinanceApplication",
  applicationSubCategory: "Herramienta para prestamistas",
  operatingSystem: "Web",
  inLanguage: "es-GT",
  browserRequirements: "Requiere JavaScript y un navegador moderno.",
  countryOfOrigin: {
    "@type": "Country",
    name: "Guatemala",
  },
  audience: {
    "@type": "BusinessAudience",
    audienceType: "Prestamistas y operadores de crédito",
  },
  featureList: [
    "Cotizaciones de préstamos con interés simple",
    "Recálculo de abonos a capital",
    "Recibos y simulaciones imprimibles",
    "Planes de pago con fechas y saldos",
  ],
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string; no_disponible?: string }>;
}) {
  const { siguiente, no_disponible } = await searchParams;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const nextPath = isSafePortalPath(siguiente) ? siguiente : "/";

  return (
    <main className={styles.authPage}>
      <script
        nonce={nonce}
        suppressHydrationWarning
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
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
            <h1>Créditos y pagos, <span className={styles.noWrap}>en orden.</span></h1>
            <span>Cotiza, registra y entrega documentos claros.</span>
          </div>
          <ul>
            <li>Cotizar</li>
            <li>Registrar</li>
            <li>Imprimir</li>
          </ul>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.formHeading}>
            <p>Acceso seguro</p>
            <h2>Iniciar sesión</h2>
            {no_disponible === "1" && (
              <p role="alert">El servicio no está disponible.</p>
            )}
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
