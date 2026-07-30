import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Créditos",
    description: SITE_DESCRIPTION,
    start_url: "/acceso",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#4f46e5",
    lang: "es-GT",
    orientation: "any",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
