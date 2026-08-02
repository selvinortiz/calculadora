"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-GT">
      <body>
        <main className="appPage" role="alert">
          <header className="pageHeader">
            <p className="pageEyebrow">Servicio temporalmente no disponible</p>
            <h1 className="pageTitle">No pudimos verificar tu sesión</h1>
            <p className="pageIntro">Tus datos no se modificaron. Espera un momento e intenta nuevamente.</p>
            <button type="button" onClick={reset}>Reintentar</button>
          </header>
        </main>
      </body>
    </html>
  );
}
