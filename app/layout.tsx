import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND, COUNTRY, IS_HUB, LANGUAGE, siteUrl } from "@/config";
import { themeCss } from "@/ui/theme";
import { I18nProvider } from "@/i18n/context";
import ServiceWorkerRegister from "@/features/app/ServiceWorkerRegister";
import { SITE } from "@/config";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: IS_HUB ? BRAND.platform : BRAND.name,
    template: `%s · ${IS_HUB ? BRAND.platform : BRAND.short}`,
  },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: BRAND.name,
    description: BRAND.tagline,
    locale: LANGUAGE.default,
  },
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.tagline },
  // Searching for a person or a shelter is nobody else's business: no crawl of anything
  // deeper than the public map itself (see app/robots.ts).
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: BRAND.colors.brand,
  width: "device-width",
  initialScale: 1,
  // Zoom stays enabled on purpose: many readers need it, and a map app that blocks
  // pinch-zoom is unusable for them.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={LANGUAGE.default} data-country={COUNTRY.slug}>
      <head>
        {/* Brand tokens from config/brand.ts, so a clone re-skins without touching CSS. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>
        <I18nProvider initial={LANGUAGE.default}>{children}</I18nProvider>
        {SITE.integrations.pwa.enabled ? <ServiceWorkerRegister /> : null}
      </body>
    </html>
  );
}
