import type { MetadataRoute } from "next";
import { getSiteUrl, PUBLIC_ENTRY_PATH } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: [PUBLIC_ENTRY_PATH, "/opengraph-image", "/favicon.ico"],
      disallow: ["/api/", "/clientes", "/financiamientos", "/financiamiento", "/abono-capital", "/ajustes", "/directorio", "/configuracion"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl.origin,
  };
}
