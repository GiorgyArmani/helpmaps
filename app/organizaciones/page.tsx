import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, COUNTRY, LANGUAGE, regionLabel } from "@/config";
import { resolveLang, translator, type DictKey } from "@/i18n";
import { Icon } from "@/ui/icons";
import { currentEmergencyId } from "@/server/emergency";
import { CookiePrefsLink } from "@/features/consent/CookieConsent";
import { dotMap, fetchDirectory, searchDirectory } from "./directory";
import FeatureTour from "./FeatureTour";
import { AgendaScreen, CampaignScreen, PostsScreen, ProfileScreen } from "./Mockups";
import "./orgs.css";

/**
 * `/organizaciones` — la página de la campaña de captación.
 *
 * ── A QUIÉN LE HABLA ────────────────────────────────────────────────────────
 *
 * A una ONG, una fundación o un comedor que ya existe y que, casi siempre, ya está en el
 * mapa sin saberlo. Por eso la acción no es un formulario de alta sino un BUSCADOR: «tu
 * organización ya está aquí, encuéntrala». Tocar la suya lleva a su ficha con
 * `?gestionar=1`, que abre la solicitud (`ManageRequest`, `db/15_gestion.sql`).
 *
 * ── LA PORTADA ES EL MAPA, HECHO CON LOS PUNTOS ─────────────────────────────
 *
 * Ni foto ni degradado: el país dibujado con los puntos publicados de verdad, uno por
 * cada lugar de ayuda. La frase «ya está en el mapa» se VE antes de leerse. Y al buscar,
 * lo encontrado se enciende en ese mismo dibujo, en respuesta a lo que hizo la persona. Lo pinta el servidor (`dotMap`), sin teselas ni
 * Leaflet: son unos cientos de círculos en un SVG.
 *
 * ── POR QUÉ ES UNA RUTA Y NO UNA VISTA DEL PANEL ────────────────────────────
 *
 * Las funciones van en el panel del mapa. Esto no es una función: es el enlace que el
 * equipo manda por WhatsApp a quien nunca abrió HelpMaps, igual que `/inicio` y `/c/<id>`.
 * Tiene que abrir con contenido, dar vista previa al pegarlo y funcionar sin cargar el
 * mapa.
 *
 * ── SIN JAVASCRIPT ──────────────────────────────────────────────────────────
 *
 * La búsqueda es un formulario GET: `?q=` vuelve a esta misma página con los resultados.
 * Funciona en el teléfono más viejo, y el enlace con `?q=` se puede mandar ya hecho.
 */

export const metadata: Metadata = (() => {
  const t = translator(LANGUAGE.default);
  return {
    // Sin la marca: la plantilla del layout ya la añade.
    title: t("orgs.metaTitle"),
    description: t("orgs.lead", { country: COUNTRY.name }),
    alternates: { canonical: "/organizaciones" },
    openGraph: { title: t("orgs.metaTitle"), description: t("orgs.lead", { country: COUNTRY.name }) },
  };
})();

const FEATURES = [
  { k: "profile", icon: Icon.eye, Screen: ProfileScreen },
  { k: "campaigns", icon: Icon.heart, Screen: CampaignScreen },
  { k: "events", icon: Icon.users, Screen: AgendaScreen },
  { k: "posts", icon: Icon.news, Screen: PostsScreen },
] as const;

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const lang = resolveLang(one(params.lang));
  const t = translator(lang);
  const query = (one(params.q) ?? "").slice(0, 80).trim();

  const directory = await fetchDirectory(await currentEmergencyId());
  const hits = query ? searchDirectory(directory, query) : [];
  const map = dotMap(directory, COUNTRY.geo, new Set(hits.map((h) => h.id)));
  const total = directory.length.toLocaleString(lang);

  const withLang = (path: string) =>
    lang === LANGUAGE.default ? path : `${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;

  return (
    <main className="olp">
      <header className="olp-top">
        <Link href={withLang("/")} className="olp-brand">
          <span className="olp-logo" aria-hidden="true">
            {BRAND.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- un asset estático
              <img src={BRAND.logo} alt="" />
            ) : (
              (BRAND.emoji || COUNTRY.code.slice(0, 1))
            )}
          </span>
          <span className="olp-brand-n">{BRAND.name}</span>
        </Link>
        <Link href={withLang("/")} className="olp-toplink">
          {t("orgs.toMap")}
          <Icon.chevron width={16} height={16} />
        </Link>
      </header>

      <section className="olp-hero">
        <div className="olp-copy">
          <h1 className="olp-h1">{t("orgs.title")}</h1>
          <p className="olp-lead">{t("orgs.lead", { country: COUNTRY.name })}</p>
        </div>

        {map ? (
          <figure className="olp-map">
            <svg
              viewBox={map.viewBox}
              role="img"
              aria-label={t("orgs.mapLabel", { n: total })}
              preserveAspectRatio="xMidYMid meet"
              // La proporción del propio encuadre: reserva el hueco exacto antes de pintar.
              style={{ aspectRatio: map.viewBox.split(" ").slice(2).join(" / ") }}
            >
              {/* La silueta, rellena de una trama de puntos: un solo trazado y un patrón, en
                  vez de miles de círculos. Sobre ella, los lugares de ayuda de verdad. */}
              {map.outline ? (
                <>
                  <defs>
                    <pattern id="olp-grain" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
                      <circle cx="1.3" cy="1.3" r="0.5" />
                    </pattern>
                  </defs>
                  <path className="olp-land" d={map.outline} fill="url(#olp-grain)" />
                </>
              ) : null}
              {/* Brotan al cargar, en orden salteado por todo el país (`k`). */}
              <g className="olp-dots">
                {map.dots.map((d) => (
                  <circle
                    key={`${d.x}:${d.y}`}
                    cx={d.x}
                    cy={d.y}
                    r={0.52}
                    style={{ animationDelay: `${d.k * 0.14}s` }}
                  />
                ))}
              </g>
              {/* Y después, de vez en cuando, una onda en algún punto: actividad en vivo.
                  Se callan si hay resultados, para que lo que late sea lo encontrado. */}
              {map.hits.length === 0
                ? map.pings.map((p, i) => (
                    <circle
                      key={`p${i}`}
                      className="olp-ping"
                      cx={p.x}
                      cy={p.y}
                      r={3}
                      style={{ animationDelay: `${2 + i * 1.1}s` }}
                    />
                  ))
                : null}
              {map.hits.map((h, i) => (
                <g key={i} className="olp-hit">
                  <circle className="olp-hit-ring" cx={h.x} cy={h.y} r={2.6} />
                  <circle className="olp-hit-dot" cx={h.x} cy={h.y} r={0.95} />
                </g>
              ))}
            </svg>
            <figcaption className="olp-cap">
              {hits.length > 0 ? t("orgs.mapHits") : t("orgs.mapCaption", { n: total })}
            </figcaption>
          </figure>
        ) : null}

        {/* El buscador: la acción de la página. En el teléfono se monta sobre el borde del
            mapa; en escritorio queda bajo el titular, con el mapa a la derecha. */}
        <section id="buscar" className="olp-find" aria-labelledby="olp-find-h">
          <h2 id="olp-find-h" className="olp-find-h">
            {t("orgs.findTitle")}
          </h2>
          <p className="olp-find-p">{t("orgs.findHint")}</p>
          <form className="olp-form" action="/organizaciones#buscar" method="get" role="search">
            {lang !== LANGUAGE.default ? <input type="hidden" name="lang" value={lang} /> : null}
            <label className="olp-sr" htmlFor="olp-q">
              {t("orgs.findLabel")}
            </label>
            <input
              id="olp-q"
              className="olp-input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t("orgs.findPlaceholder")}
              autoComplete="organization"
              enterKeyHint="search"
              minLength={2}
              maxLength={80}
            />
            <button type="submit" className="olp-go">
              <Icon.search width={18} height={18} />
              <span className="olp-go-t">{t("orgs.findCta")}</span>
            </button>
          </form>

          {query ? (
            hits.length > 0 ? (
              <>
                <p className="olp-count" role="status">
                  {t("orgs.results", { n: hits.length })}
                </p>
                <ul className="olp-hits">
                  {hits.map((h) => {
                    const place = [h.municipality, regionLabel(h.region)].filter(Boolean).join(", ");
                    return (
                      <li key={h.id}>
                        <Link className="olp-hitrow" href={`/c/${encodeURIComponent(h.id)}?gestionar=1`}>
                          <span className="olp-hitrow-txt">
                            <span className="olp-hitrow-n">{h.name}</span>
                            <span className="olp-hitrow-d">
                              {t(`type.${h.type}` as DictKey)}
                              {place ? `, ${place}` : ""}
                            </span>
                          </span>
                          <span className="olp-hitrow-go">
                            {t("orgs.mine")}
                            <Icon.chevron width={16} height={16} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="olp-count" role="status">
                {t("orgs.none", { q: query })}
              </p>
            )
          ) : null}

          <p className="olp-missing">
            {t("orgs.missing")}{" "}
            <Link href={withLang("/?a=initiative")}>{t("orgs.missingCta")}</Link>
          </p>
        </section>
      </section>

      {/* Lo que tiene una organización aquí, enseñado y no enumerado: un recorrido fijo en
          el que cada tramo de scroll cambia el texto y la pantalla del perfil (`FeatureTour`). */}
      <section className="olp-band" aria-labelledby="olp-feat-h">
        <h2 id="olp-feat-h" className="olp-h2">
          {t("orgs.featTitle")}
        </h2>
        <p className="olp-sub">{t("orgs.featLead")}</p>
        <FeatureTour
          steps={FEATURES.map(({ k, icon: Glyph, Screen }) => ({
            key: k,
            icon: <Glyph width={20} height={20} />,
            title: t(`orgs.f.${k}` as DictKey),
            desc: t(`orgs.f.${k}Desc` as DictKey),
            screen: <Screen t={t} />,
          }))}
        />
        <p className="olp-demo-note">{t("orgs.demo.note")}</p>
      </section>

      {/* Cómo empezar: una tarjeta propia, con los pasos como línea de tiempo y la única
          acción de la página en grande. Es el punto donde quien ya leyó todo decide. */}
      <section className="olp-band" aria-labelledby="olp-how-h">
        <div className="olp-how">
          <h2 id="olp-how-h" className="olp-h2">
            {t("orgs.howTitle")}
          </h2>
          {/* Numerados porque SÍ son una secuencia: uno lleva al otro. */}
          <ol className="olp-steps">
            {(["1", "2", "3"] as const).map((n) => (
              <li key={n} className="olp-step">
                <span className="olp-step-n" aria-hidden="true">
                  {n}
                </span>
                <div>
                  <h3 className="olp-step-h">{t(`orgs.step${n}Title` as DictKey)}</h3>
                  <p className="olp-step-t">{t(`orgs.step${n}` as DictKey)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="olp-how-cta">
            <a href="#buscar" className="olp-cta">
              <Icon.search width={20} height={20} />
              <span>{t("orgs.findTitle")}</span>
              <Icon.chevron width={18} height={18} />
            </a>
            <p className="olp-cta-note">{t("orgs.ctaNote")}</p>
          </div>
        </div>
      </section>

      {/* El cierre: la promesa que decide si una organización confía, dicha en grande. */}
      <section className="olp-promise" aria-labelledby="olp-free-h">
        <div className="olp-promise-in">
          <h2 id="olp-free-h" className="olp-promise-h">
            {t("orgs.freeTitle")}
          </h2>
          <p className="olp-promise-p">{t("orgs.freeBody", { platform: BRAND.platform })}</p>
        </div>

        <footer className="olp-foot">
          <span>{BRAND.name}</span>
          <Link href={`/docs/privacidad?lang=${lang}`}>{t("footer.privacy")}</Link>
          <Link href={`/docs/terminos?lang=${lang}`}>{t("footer.terms")}</Link>
          <CookiePrefsLink className="olp-foot-cookie" label={t("footer.cookies")} />
        </footer>
      </section>
    </main>
  );
}
