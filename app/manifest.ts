import type { MetadataRoute } from "next";
import { BRAND, LANGUAGE, SITE } from "@/config";

/**
 * PWA manifest. Installing matters here: a phone that has the app on its home screen
 * opens the last cached map without waiting on a connection that may not come back.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.short,
    description: BRAND.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: BRAND.colors.brand,
    lang: LANGUAGE.default,
    orientation: "portrait",
    categories: ["utilities", "social"],
    icons: SITE.integrations.pwa.enabled
      ? [
          { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : [],
  };
}
