import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BRAND, IS_HUB } from "@/config";
import { currentEmergency, getSite } from "@/server/emergency";
import { themeCss } from "@/ui/theme";
import { I18nProvider } from "@/i18n/context";
import { SiteProvider } from "@/features/app/SiteProvider";
import ServiceWorkerRegister from "@/features/app/ServiceWorkerRegister";
import Analytics from "@/features/app/Analytics";
import RecoveryRedirect from "@/features/account/RecoveryRedirect";

/**
 * La tipografía de la plataforma.
 *
 * Hasta ahora la marca pedía `'Helvetica Neue', Helvetica, Arial`, que en Android y en
 * Windows no existe: caía en Arial y en Roboto. Ese es el motivo real de que la interfaz
 * «pareciera sin diseñar» — no los colores ni los bordes, sino que cada sistema la
 * dibujaba con una letra distinta y ninguna elegida.
 *
 * Va por `next/font`, que la sirve desde nuestro propio dominio con la fuente ya
 * subsetada: no hay petición a Google desde el navegador de nadie —que además es un dato
 * de tráfico que este proyecto no tiene por qué repartir— ni salto de texto al cargar,
 * porque Next reserva la métrica con una fuente de respaldo ajustada.
 *
 * `--font-jakarta` la lee `config/brand.ts` dentro de `font.sans`, así que un país que
 * quiera otra letra sigue cambiándola en su preset y no aquí.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

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
    <html lang={site.language.default} data-country={site.country.slug} className={jakarta.variable}>
      <head>
        {/* Brand tokens from the resolved config, so a clone re-skins without touching CSS. */}
        <style dangerouslySetInnerHTML={{ __html: themeCss(site.brand) }} />
      </head>
      <body>
        {/* Antes que nada: si el enlace de «elige tu contraseña» aterrizó en la raíz
            porque Supabase descartó el `redirectTo`, esto lo lleva a `/reset` con el
            token intacto. Ver el componente — el arreglo de verdad es de configuración. */}
        <RecoveryRedirect />
        <SiteProvider site={site} emergency={identity}>
          <I18nProvider initial={site.language.default}>{children}</I18nProvider>
        </SiteProvider>
        {site.integrations.pwa.enabled ? <ServiceWorkerRegister /> : null}
        <Analytics id={site.integrations.analytics.ga} country={site.country.code} />
      </body>
    </html>
  );
}
