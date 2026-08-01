"use client";

import { useEffect } from "react";

export default function ApplicationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application route failed.", error);
  }, [error]);

  return <main className="appPage" role="alert">
    <header className="pageHeader">
      <p className="pageEyebrow">Servicio temporalmente no disponible</p>
      <h1 className="pageTitle">No pudimos cargar esta página</h1>
      <p className="pageIntro">Tus datos no se modificaron. Revisa la conexión e intenta nuevamente.</p>
      <button type="button" onClick={reset}>Reintentar</button>
    </header>
  </main>;
}
