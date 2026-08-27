import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js).
 *
 * Rendered once from the root layout when `integrations.analytics.ga` holds a measurement
 * id, so the same tag covers the entry page (`/inicio`) and the map without wiring it into
 * each route. A deployment that wants no Google analytics leaves the field empty and this
 * renders nothing — no script, no `dataLayer`.
 *
 * Pageviews only. The project's rule against logging who searches for whom applies here as
 * much as to `analytics.vercel`: never push custom events carrying names, documents or
 * search terms into `dataLayer`.
 */
export default function Analytics({ id }: { id: string }) {
  if (!id) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
