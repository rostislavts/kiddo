import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/config";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/parent", "/admin", "/api", "/auth", "/select-child", "/setup"],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
