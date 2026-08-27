import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND, IS_HUB } from "@/config";
import { currentEmergency, getSite } from "@/server/emergency";
import { themeCss } from "@/ui/theme";
import { I18nProvider } from "@/i18n/context";
import { SiteProvider } from "@/features/app/SiteProvider";
import ServiceWorkerRegister from "@/features/app/ServiceWorkerRegister";
import Analytics from "@/features/app/Analytics";

/**
 * Metadata is generated rather than exported as a constant because the title, the
 * description and the canonical origin now come from the resolved configuration — an
 * emergency row when there is one, the compiled preset otherwise. A static export cannot
 * await that.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  const brand = site.brand;
  const name = IS_HUB ? brand.platform : brand.name;
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? `https://${site.country.host}`,
    ),
    title: { default: name, template: `%s · ${IS_HUB ? brand.platform : brand.short}` },
    description: brand.tagline,
    applicationName: brand.name,
    openGraph: {
      type: "website",
      siteName: brand.name,
      title: brand.name,
      description: brand.tagline,
      locale: site.language.default,
    },
    twitter: { card: "summary_large_image", title: brand.name, description: brand.tagline },
    // Searching for a person or a shelter is nobody else's business: no crawl of anything
    // deeper than the public map itself (see app/robots.ts).
    robots: { index: true, follow: true },
  };
}

// Stays a constant: the theme colour is read before the first paint and a resolved brand is
// not worth an extra round trip in front of it. A country that repaints its brand changes
// the address-bar tint on the next deploy, and nothing else waits on that.
export const viewport: Viewport = {
  themeColor: BRAND.colors.brand,
  width: "device-width",
  initialScale: 1,
  // Zoom stays enabled on purpose: many readers need it, and a map app that blocks
  // pinch-zoom is unusable for them.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved once per request, here, and handed down. Everything below — server components
  // through props, client components through `useSite()` — reads this same object, so the
  // page cannot render half from a row and half from the compiled preset.
  const resolved = await currentEmergency();
  const site = resolved?.site ?? (await getSite());
  // The configuration crosses to the client whole; the identity crosses without it, so the
  // same object is not serialised twice into the payload.
  const identity = resolved
    ? {
        id: resolved.id,
        slug: resolved.slug,
        name: resolved.name,
        hazardType: resolved.hazardType,
        status: resolved.status,
        maintenance: resolved.maintenance,
        notice: resolved.notice,
        layers: resolved.layers,
        news: resolved.news,
      }
    : null;

  return (
    <html lang={site.language.default} data-country={site.country.slug}>
      <head>
        {/* Brand tokens from the resolved config, so a clone re-skins without touching CSS. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(site.brand) }} />
      </head>
      <body>
        <SiteProvider site={site} emergency={identity}>
          <I18nProvider initial={site.language.default}>{children}</I18nProvider>
        </SiteProvider>
        {site.integrations.pwa.enabled ? <ServiceWorkerRegister /> : null}
        <Analytics id={site.integrations.analytics.ga} country={site.country.code} />
      </body>
    </html>
  );
}
