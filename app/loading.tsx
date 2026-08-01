export default function ApplicationLoading() {
  return <main className="appPage" aria-busy="true" aria-live="polite">
    <header className="pageHeader">
      <p className="pageEyebrow">Cargando</p>
      <h1 className="pageTitle">Preparando tus datos…</h1>
    </header>
  </main>;
}
