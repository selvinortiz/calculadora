import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { getCurrentPortalSession } from "@/lib/current-portal-session";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Calculadora de Créditos",
  title: {
    default: "Calculadora de Créditos",
    template: "%s | Calculadora de Créditos",
  },
  description:
    "Herramienta operativa para cotizar créditos y registrar abonos a capital con interés simple en quetzales.",
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
