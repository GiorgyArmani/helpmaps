import type { MetadataRoute } from "next";
import { siteUrl } from "@/config";

/**
 * The map and the shareable point cards are meant to be found. The staff panel, the sign
 * in page and the API are not: indexing them adds nothing for anyone searching for help
 * and puts the team's surface in a search engine.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/login", "/api/"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
