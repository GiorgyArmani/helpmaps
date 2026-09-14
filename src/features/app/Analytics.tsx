"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useConsent } from "@/features/consent/consent";

/**
 * Google Analytics 4 (gtag.js) — SÓLO con permiso.
 *
 * Montado una vez desde el layout raíz cuando `integrations.analytics.ga` tiene un id. Un
 * despliegue que no quiere analítica deja el campo vacío y esto no pinta nada.
 *
 * ── CONSENTIMIENTO ────────────────────────────────────────────────────────
 *
 * Mientras la persona no acepte en `CookieConsent`, aquí no se descarga NADA: ni gtag.js ni
 * `dataLayer`. Antes arrancaba en Consent Mode `denied` y se creía suficiente, pero el
 * script llegaba igual a Google y enviaba avisos sin cookie con la IP y la página — y eso,
 * para el RGPD y el art. 22.2 de la LSSI, también es acceder al dispositivo. Ver
 * `src/features/consent/consent.ts`.
 *
 * ── UNA PROPIEDAD PARA TODOS LOS PAÍSES ─────────────────────────────────────
 *
 * Todos los despliegues son el mismo build con distinto `NEXT_PUBLIC_COUNTRY`, y
 * `integrations` no se sobreescribe por país: el mismo id cae en una sola propiedad GA4.
 * `country_code` va en el `config` para partir los informes por despliegue (regístralo como
 * dimensión personalizada en GA4).
 *
 * ── SÓLO PÁGINAS VISTAS, Y SIN `?query` ─────────────────────────────────────
 *
 * La visita se envía a mano con `origin + pathname`. Por la query viajan cosas que no son de
 * Google — el `?code=` que canjea una sesión, un token de invitación — y la URL completa
 * las mandaría. Por eso también `send_page_view: false`: la vista automática llevaría la
 * dirección entera.
 *
 * ⚠️ En GA4 → Flujo de datos → Medición mejorada hay que APAGAR «cambios de página basados
 * en eventos del historial» y «búsqueda en el sitio»: los dos leen la URL completa por su
 * cuenta, sin pasar por aquí.
 *
 * La regla de no registrar quién busca a quién rige igual: nunca eventos propios con
 * nombres, documentos ni términos de búsqueda.
 */
export default function Analytics({ id, country }: { id: string; country: string }) {
  const consent = useConsent();
  const pathname = usePathname();
  const on = Boolean(id) && consent === "granted";

  useEffect(() => {
    if (!on) return;
    if (!window.gtag) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        // gtag.js lee el objeto `arguments` tal cual; una copia en array no la entiende.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments);
      };
      window.gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted",
      });
      window.gtag("js", new Date());
      window.gtag("config", id, { send_page_view: false, ...(country ? { country_code: country } : {}) });
    }
    window.gtag("event", "page_view", {
      page_location: window.location.origin + window.location.pathname,
      page_title: document.title,
    });
  }, [on, pathname, id, country]);

  if (!on) return null;
  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />;
}
