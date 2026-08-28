import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js).
 *
 * Rendered once from the root layout when `integrations.analytics.ga` holds a measurement
 * id, so the same tag covers the entry page (`/inicio`) and the map without wiring it into
 * each route. A deployment that wants no Google analytics leaves the field empty and this
 * renders nothing — no script, no `dataLayer`.
 *
 * ── ONE PROPERTY FOR EVERY COUNTRY ────────────────────────────────────────
 *
 * Every deployment (`co.helpmaps.net`, `ve.helpmaps.net`, …) is the same build with a
 * different `NEXT_PUBLIC_COUNTRY`, and `integrations` is not overridable per country — so
 * the same measurement id lands them all in one GA4 property. `country` is sent on the
 * `config` call as the `country_code` parameter; register it as a custom dimension in the
 * GA4 admin and every report can be broken down by deployment without relying on the
 * hostname. The `_ga` cookie already spans `*.helpmaps.net`, so a visitor crossing between
 * two country maps is still one user.
 *
 * ── CONSENT MODE ─────────────────────────────────────────────────────────
 *
 * `analytics_storage` (and the ad signals) default to `denied` BEFORE gtag.js loads, so
 * out of the box GA runs cookieless: no `_ga` cookie is written, only Google's aggregated
 * consent-mode pings. A deployment that later adds a consent banner grants it by calling
 * `gtag('consent', 'update', { analytics_storage: 'granted' })` on acceptance. Until then
 * the privacy-preserving mode is the one in effect, which is the right default for a map
 * people open while searching for help.
 *
 * Pageviews only. The project's rule against logging who searches for whom applies here as
 * much as to `analytics.vercel`: never push custom events carrying names, documents or
 * search terms into `dataLayer`.
 */
export default function Analytics({ id, country }: { id: string; country: string }) {
  if (!id) return null;
  const config = country ? `${JSON.stringify(id)}, { country_code: ${JSON.stringify(country)} }` : JSON.stringify(id);
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
});
gtag('js', new Date());
gtag('config', ${config});`}
      </Script>
    </>
  );
}
