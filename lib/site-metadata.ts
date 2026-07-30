export const SITE_NAME = "Calculadora de Créditos";
export const SITE_TITLE = "Calculadora de Créditos para Prestamistas";
export const SITE_DESCRIPTION =
  "Portal para prestamistas que cotiza créditos con interés simple, recalcula abonos a capital, ajusta saldos a favor y genera documentos en quetzales.";
export const PUBLIC_ENTRY_PATH = "/acceso";
export const DEFAULT_SITE_URL = "https://calculacuota.com";

export function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;

  try {
    const url = new URL(
      configuredUrl.startsWith("http")
        ? configuredUrl
        : `https://${configuredUrl}`,
    );
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}
