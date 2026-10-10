import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/how-it-works", "/curriculum", "/pricing", "/faq", "/privacy", "/terms"].map(
    (path) => ({
      url: `${appUrl()}${path}`,
      changeFrequency: "monthly",
      priority: path === "" ? 1 : 0.7,
    }),
  );
}
