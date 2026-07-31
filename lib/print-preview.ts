const PRINT_FRAME_ATTRIBUTE = "data-isolated-print-frame";

export async function printElement(element: HTMLElement, title = document.title) {
  document.querySelectorAll(`iframe[${PRINT_FRAME_ATTRIBUTE}]`).forEach((frame) => frame.remove());

  const frame = document.createElement("iframe");
  frame.setAttribute(PRINT_FRAME_ATTRIBUTE, "true");
  frame.setAttribute("aria-hidden", "true");
  frame.title = "Vista de impresión";
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "816px",
    height: "1056px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.append(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) return false;

  const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("\n");
  const htmlClassName = document.documentElement.className;
  const bodyClassName = document.body.className;

  printDocument.open();
  printDocument.write(`<!doctype html>
<html lang="es-GT" class="${escapeAttribute(htmlClassName)}">
  <head>
    <meta charset="utf-8">
    <base href="${escapeAttribute(window.location.origin)}/">
    <title>${escapeHtml(title)}</title>
    ${styles}
    <style>
      html, body { min-width: 0 !important; margin: 0 !important; background: #fff !important; }
      body {
        padding: 24px !important;
        font-family: var(--font-geist-sans, Arial), Helvetica, sans-serif !important;
      }
      .isolatedPrintRoot { width: min(100%, 8.5in); margin: 0 auto; }
      @media print {
        body { padding: 0 !important; }
        .isolatedPrintRoot { width: 100%; margin: 0; }
      }
    </style>
  </head>
  <body class="${escapeAttribute(bodyClassName)}">
    <main class="isolatedPrintRoot">${element.outerHTML}</main>
  </body>
</html>`);
  printDocument.close();

  await waitForStyles(printDocument);
  if (printDocument.fonts) await printDocument.fonts.ready;
  await afterTwoFrames(printWindow);

  printWindow.focus();
  printWindow.print();
  return true;
}

async function waitForStyles(target: Document) {
  const links = Array.from(target.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  await Promise.all(links.map((link) => {
    if (link.sheet) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const finish = () => resolve();
      link.addEventListener("load", finish, { once: true });
      link.addEventListener("error", finish, { once: true });
      window.setTimeout(finish, 2000);
    });
  }));
}

function afterTwoFrames(target: Window) {
  return new Promise<void>((resolve) => {
    target.requestAnimationFrame(() => target.requestAnimationFrame(() => resolve()));
  });
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}
