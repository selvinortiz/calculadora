import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import {
  getSiteUrl,
  PUBLIC_ENTRY_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
} from "@/lib/site-metadata";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "calculadora de créditos",
    "interés simple",
    "abono a capital",
    "préstamos en Guatemala",
    "calculadora para prestamistas",
    "plan de pagos",
    "recibo de pago",
    "quetzales",
  ],
  category: "finance",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
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
    index: false,
    follow: false,
    noarchive: true,
  },
  other: {
    "geo.region": "GT",
    "geo.placename": "Guatemala",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentPortalSession();

  return (
    <html lang="es-GT">
      <body className={geist.variable}>
        <div className={`appShell${session ? "" : " authShell"}`}>
          {session && (
            <AppHeader
              operatorCompany={session.company}
              operatorName={session.name}
            />
          )}
          <div className="appWorkspace">
            {children}
            <footer className="appFooter" data-print-hidden>
              <p>
                Préstamos con interés simple · Abonos a capital · Documentos claros
              </p>
              <p>
                <a
                  href="https://wa.me/16128078475?text=Hola%2C%20necesito%20ayuda%20con%20la%20calculadora."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contactar soporte
                </a>
              </p>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
