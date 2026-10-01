import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, COUNTRY, LANGUAGE, regionLabel } from "@/config";
import { resolveLang, translator, type DictKey } from "@/i18n";
import { Icon } from "@/ui/icons";
import { currentEmergencyId } from "@/server/emergency";
import { CookiePrefsLink } from "@/features/consent/CookieConsent";
import AsciiMap from "./AsciiMap";
import { dotMap, fetchDirectory, mapSpots, roundedCount } from "./directory";
import OrgFinder from "./OrgFinder";
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
 * Ni foto ni degradado: el país en ASCII, el mismo de `/inicio` (`AsciiMap`), con los
 * lugares publicados de verdad en tinta. La frase «ya está en el mapa» se VE antes de
 * leerse. Y al buscar, lo encontrado late en ese mismo dibujo, en respuesta a lo que hizo
 * la persona. Lo pinta el servidor, sin teselas ni Leaflet: unas filas de texto en un SVG.
 *
 * ── POR QUÉ ES UNA RUTA Y NO UNA VISTA DEL PANEL ────────────────────────────
 *
 * Las funciones van en el panel del mapa. Esto no es una función: es el enlace que el
 * equipo manda por WhatsApp a quien nunca abrió HelpMaps, igual que `/inicio` y `/c/<id>`.
 * Tiene que abrir con contenido, dar vista previa al pegarlo y funcionar sin cargar el
 * mapa.
 *
 * ── MIENTRAS SE ESCRIBE, Y SIN JAVASCRIPT ───────────────────────────────────
 *
 * Los resultados salen a cada tecla, filtrados en el teléfono (`OrgFinder`), y `?q=` se
 * escribe en la dirección sin recargar. Sin JavaScript sigue siendo un formulario GET que
 * vuelve aquí con los resultados, y el enlace con `?q=` se puede mandar ya hecho.
 */

export const metadata: Metadata = (() => {
  const t = translator(LANGUAGE.default);
  return {
    // Sin la marca: la plantilla del layout ya la añade.
    title: t("orgs.metaTitle"),
    description: t("orgs.lead", { country: COUNTRY.name, platform: BRAND.platform }),
    alternates: { canonical: "/organizaciones" },
    openGraph: { title: t("orgs.metaTitle"), description: t("orgs.lead", { country: COUNTRY.name, platform: BRAND.platform }) },
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
  const map = dotMap(directory, COUNTRY.geo);
  // Todo el directorio va al buscador, que filtra en el teléfono mientras se escribe
  // (`OrgFinder`). Sólo lo que pinta: nombre, una línea de texto y su sitio en el dibujo.
  const spots = map ? mapSpots(directory, COUNTRY.geo, map.viewBox) : new Map();
  const finderEntries = directory.map((d) => ({
    id: d.id,
    name: d.name,
    desc: [t(`type.${d.type}` as DictKey), d.municipality, regionLabel(d.region)].filter(Boolean).join(", "),
    spot: spots.get(d.id) ?? null,
  }));
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
          <p className="olp-lead">{t("orgs.lead", { country: COUNTRY.name, platform: BRAND.platform })}</p>
          <p className="olp-lead olp-lead2">{t("orgs.lead2")}</p>
          {/* La prueba, en una línea: no es un punto de la lista, es por qué creerle. */}
          <p className="olp-proof">{t("orgs.proof", { n: roundedCount(directory.length, lang) })}</p>
        </div>

        <OrgFinder
          entries={finderEntries}
          initialQuery={query}
          map={
            map ? (
              // El mismo país en ASCII que la portada de /inicio.
              <AsciiMap entries={directory} viewBox={map.viewBox} label={t("orgs.mapLabel", { n: total })} />
            ) : null
          }
          labels={{
            mapHits: t("orgs.mapHits"),
            mapCaption: t("orgs.mapCaption"),
            findTitle: t("orgs.findTitle"),
            findHint: t("orgs.findHint"),
            findLabel: t("orgs.findLabel"),
            findPlaceholder: t("orgs.findPlaceholder"),
            findCta: t("orgs.findCta"),
            results: t("orgs.results"),
            none: t("orgs.none"),
            mine: t("orgs.mine"),
            missing: t("orgs.missing"),
            missingCta: t("orgs.missingCta"),
          }}
          missingHref={withLang("/?a=initiative")}
          lang={lang !== LANGUAGE.default ? lang : undefined}
        />
      </section>

      {/* Lo que tiene una organización aquí, enseñado y no enumerado: el mismo recorrido
          de /inicio (`FeatureTour`), que maneja la persona. */}
      <section className="olp-band" aria-labelledby="olp-feat-h">
        <h2 id="olp-feat-h" className="olp-h2">
          {t("orgs.featTitle", { platform: BRAND.platform })}
        </h2>
        <p className="olp-sub">{t("orgs.featLead")}</p>
        <FeatureTour
          manual={{ prev: t("home.tourPrev"), next: t("home.tourNext") }}
          steps={FEATURES.map(({ k, icon: Glyph, Screen }) => ({
            key: k,
            icon: <Glyph width={20} height={20} />,
            title: t(`orgs.f.${k}` as DictKey),
            desc: t(`orgs.f.${k}Desc` as DictKey, { platform: BRAND.platform }),
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
          <p className="olp-promise-p">{t("orgs.freeBody2")}</p>
          {/* La acción otra vez, al final de la lectura: buscar la suya, o agregarla si no
              está. En el teléfono, apiladas y a lo ancho; en escritorio, en fila. */}
          <div className="olp-promise-acts">
            <a href="#buscar" className="olp-cta olp-cta-light">
              <Icon.search width={20} height={20} />
              <span>{t("orgs.findTitle")}</span>
              <Icon.chevron width={18} height={18} />
            </a>
            <Link href={withLang("/?a=initiative")} className="olp-cta olp-cta-ghost">
              <Icon.plus width={20} height={20} />
              <span>{t("orgs.endAdd")}</span>
            </Link>
          </div>
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
