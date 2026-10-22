import type { MetadataRoute } from "next";

const base = "https://vikramengineering.co.in";

/** Single-page site: one URL. Sections are in-page anchors. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
