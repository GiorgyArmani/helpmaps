import Link from "next/link";
import dynamic from "next/dynamic";
import { BRAND, LANGUAGE, NETWORK } from "@/config";
import { translator } from "@/i18n";
import { LANG_NAME } from "@/ui/flags";
import type { Lang } from "@/i18n/types";

const HubMap = dynamic(() => import("@/features/hub/HubMap"));

/**
 * helpmaps.net — the network hub.
 *
 * Three jobs, in the order a visitor needs them: where HelpMaps is running (a map, one
 * pin per country, clickable), what it is, and how to take part — bring it to your
 * country, contribute code, or contribute data. The API documentation and the terms hang
 * off it.
 *
 * Server-rendered: this page is the front door for press, funders and partner
 * organisations, so it has to arrive as HTML, fast, and be readable by a crawler.
 *
 * ── SOBRE LA JERARQUÍA ──────────────────────────────────────────────────────
 *
 * El nombre y la frase van en UN SOLO `h1`, en dos líneas: la marca grande, la frase
 * debajo y más pequeña. Antes eran dos cosas sueltas —un `div` con el logo y un `h1` con
 * la frase— y el resultado era que "HelpMaps" quedaba como el elemento MÁS PEQUEÑO de
 * una portada que existe para presentarlo. Juntarlos también arregla el esquema de
 * encabezados: el `h1` de helpmaps.net ahora dice cómo se llama esto.
 *
 * Cada bloque de sección (título + subtítulo) va envuelto, para que el espacio pueda
 * agrupar: poco aire entre el título y su bajada, mucho entre una sección y la
 * siguiente. Con un `gap` uniforme —lo que había— la bajada quedaba tan lejos de su
 * título como el título de la sección anterior, y nada se leía como un grupo.
 */
export default function HubLanding({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const live = NETWORK.filter((d) => d.status === "live");

  return (
    <main className="hub">
      {/* Selector de idioma por ENLACE, no el `LangSwitcher` de la app de país.
       *
       * Aquel guarda el idioma en estado de cliente, y esta portada se renderiza en
       * SERVIDOR (`app/page.tsx` lee `?lang=` y pasa el idioma como prop). Reutilizarlo
       * habría dado un botón que cambia el contexto y no cambia ni una palabra de lo que
       * se ve: todo el texto ya vino resuelto del servidor.
       *
       * Con enlaces, el servidor vuelve a renderizar en el idioma pedido. Sale gratis:
       * funciona sin JavaScript, es una URL que se puede compartir y un rastreador la
       * sigue, que es justo lo que esta página necesita.
       *
       * Cada idioma se nombra EN SU PROPIO IDIOMA — quien busca "English" no sabe
       * necesariamente qué es "Inglés". */}
      {LANGUAGE.available.length > 1 ? (
        <div className="hub-langs">
          {LANGUAGE.available.map((l) => (
            <Link
              key={l}
              className="hub-lang"
              href={l === LANGUAGE.default ? "/" : `/?lang=${l}`}
              hrefLang={l}
              aria-label={LANG_NAME[l]}
              aria-current={l === lang ? "true" : undefined}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
      ) : null}

      <header className="hub-hero">
        <h1 className="hub-masthead">
          <span className="hub-mark">
            {BRAND.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- ruta de configuración, no un asset de tamaño conocido
              <img className="hub-mark-logo" src={BRAND.logo} alt="" width={64} height={64} />
            ) : null}
            <span className="hub-wordmark">{BRAND.platform}</span>
          </span>
          <span className="hub-tagline">{t("hub.tagline")}</span>
        </h1>

        <p className="hub-lead">{t("hub.whatBody")}</p>

        <div className="hub-actions">
          <a className="hub-cta" href="#paises">
            {t("hub.networkTitle")}
          </a>
          <Link className="hub-action" href="/docs/desplegar">
            {t("hub.joinCountry")}
          </Link>
        </div>
      </header>

      <section className="hub-section" id="paises">
        <div className="hub-head">
          <h2 className="hub-h2">{t("hub.networkTitle")}</h2>
          <p className="hub-sub">{t("hub.networkSubtitle")}</p>
        </div>

        <HubMap />

        <ul className="hub-grid">
          {NETWORK.map((d) => {
            const isLive = d.status === "live";
            const body = (
              <>
                <span className="hub-card-title">
                  <span className="hub-flag" aria-hidden>
                    {d.flag}
                  </span>
                  <span className="hub-card-name">{d.name}</span>
                  <span className="hub-status" data-live={isLive || undefined}>
                    {isLive ? t("hub.live") : t("hub.preparing")}
                  </span>
                </span>
                {d.note ? <span className="hub-card-body">{d.note}</span> : null}
                {isLive ? <span className="hub-host">{hostOf(d.url)}</span> : null}
              </>
            );
            return (
              <li key={d.slug}>
                {isLive ? (
                  <a
                    className="hub-card"
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("hub.openSite", { name: d.name })}
                  >
                    {body}
                  </a>
                ) : (
                  <div className="hub-card">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Cada tarjeta ES el enlace, como las de país.
       *
       * Antes el enlace era una línea DENTRO de la tarjeta, y eso produjo dos cosas
       * malas: la primera repetía literalmente su propio título ("Traer HelpMaps a tu
       * país" arriba y abajo), y la de aportar datos decía "Abrir Colombia" — el primer
       * despliegue vivo de la lista, que no tiene nada que ver con querer aportar datos y
       * que además cambiaría solo el día que se sume otro país antes en el orden.
       *
       * Ahora el destino es el asunto de la tarjeta: la guía de despliegue, el
       * repositorio, y la lista de países —que está justo arriba— para quien quiera
       * aportar datos, porque los datos se aportan en el mapa de cada país. */}
      <section className="hub-section" id="sumate">
        <div className="hub-head">
          <h2 className="hub-h2">{t("hub.joinTitle")}</h2>
        </div>
        <ul className="hub-grid">
          <li>
            <Link className="hub-card" href="/docs/desplegar">
              <span className="hub-card-title">
                <span className="hub-card-name">{t("hub.joinCountry")}</span>
              </span>
              <span className="hub-card-body">{t("hub.joinCountryBody")}</span>
            </Link>
          </li>
          {BRAND.contact.repo ? (
            <li>
              <a
                className="hub-card"
                href={BRAND.contact.repo}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="hub-card-title">
                  <span className="hub-card-name">{t("hub.joinContribute")}</span>
                </span>
                <span className="hub-card-body">{t("hub.joinContributeBody")}</span>
                {/* Adónde lleva, en claro: es un salto fuera del sitio y a otra pestaña,
                    y decirlo antes de pulsar cuesta una línea. */}
                <span className="hub-host">{hostPathOf(BRAND.contact.repo)}</span>
              </a>
            </li>
          ) : null}
          <li>
            <a className="hub-card" href="#paises">
              <span className="hub-card-title">
                <span className="hub-card-name">{t("hub.joinData")}</span>
              </span>
              <span className="hub-card-body">{t("hub.joinDataBody")}</span>
            </a>
          </li>
        </ul>
      </section>

      <section className="hub-section" id="api">
        <div className="hub-head">
          <h2 className="hub-h2">{t("hub.apiTitle")}</h2>
          <p className="hub-sub">{t("hub.apiBody")}</p>
        </div>
        <code className="hub-code">
          {live
            .map((d) => `GET ${d.url}/api/v1/centers?needs=true`)
            .join("\n") || "GET https://<pais>.helpmaps.net/api/v1/centers"}
        </code>
        {/* Sin `<p>` envolviendo el enlace: su margen por defecto se sumaba al `gap` de
            la sección y abría un hueco del doble que el resto de la página. */}
        <Link className="hub-action" href="/docs/api">
          {t("hub.apiDocs")}
        </Link>
      </section>

      <footer className="hub-foot">
        <Link href="/docs/terminos">{t("hub.terms")}</Link>
        <Link href="/docs/privacidad">{t("footer.privacy")}</Link>
        <Link href="/docs/api">{t("footer.api")}</Link>
        <Link href="/docs/desplegar">{t("hub.joinCountry")}</Link>
        {/* El correo vivía dentro de la tarjeta de contribuir. Al convertirla en un
            enlace al repositorio se quedaba sin sitio, y era el único contacto de toda
            la página — que es exactamente lo que se pone en un pie. */}
        <a href={`mailto:${BRAND.contact.email}`}>{BRAND.contact.email}</a>
      </footer>
    </main>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Como `hostOf`, con la ruta: en un repositorio el dueño y el nombre son el dato. */
function hostPathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}
