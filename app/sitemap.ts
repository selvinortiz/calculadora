import type { MetadataRoute } from "next";
import { getSiteUrl, PUBLIC_ENTRY_PATH } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: new URL(PUBLIC_ENTRY_PATH, getSiteUrl()).toString(),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
