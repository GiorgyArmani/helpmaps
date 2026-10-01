import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND, COUNTRY, FEATURES, IS_HUB, LANGUAGE, enabledTypes, regionLabel } from "@/config";
import { resolveLang, translator, type DictKey } from "@/i18n";
import type { LocationType } from "@/domain/types";
import { Icon } from "@/ui/icons";
import { currentEmergency } from "@/server/emergency";
import NewsSection from "@/features/news/NewsSection";
import { CookiePrefsLink } from "@/features/consent/CookieConsent";
import { dotMap, emergencyFocus, fetchDirectory } from "../organizaciones/directory";
import FeatureTour from "../organizaciones/FeatureTour";
import { JoinScreen, LevelScreen, NearScreen, NeedsScreen } from "./Mockups";
import "../organizaciones/orgs.css";
import "./inicio.css";

/**
 * `/inicio` — la portada. A donde apunta el QR impreso y lo que se manda por WhatsApp.
 *
 * ── A QUIÉN LE HABLA ────────────────────────────────────────────────────────
 *
 * A una PERSONA: quien busca ayuda ahora y quien quiere darla. `/organizaciones` es la
 * misma página para una ONG; ésta comparte su lenguaje (el país dibujado con los puntos, el
 * recorrido con el teléfono, el cierre en tinta) y reusa `orgs.css` para no tener dos
 * versiones de las mismas piezas. Lo propio va en `inicio.css`.
 *
 * ── LAS DOS PUERTAS VAN PRIMERO ─────────────────────────────────────────────
 *
 * `proxy.ts` manda aquí UNA vez a quien abre `/` por primera vez, y esa persona puede
 * estar buscando un refugio. Por eso «Necesito ayuda» / «Quiero ayudar» están en la
 * portada, montadas sobre el mapa, antes de cualquier explicación: se entra sin cuenta y
 * sin leer nada. La cuenta se ofrece después, diciendo qué da de verdad.
 *
 * ── LO QUE DA LA CUENTA ES LO QUE HACE LA APP ───────────────────────────────
 *
 * Guardar puntos, avisar de un cambio (lo revisa el equipo), anotarse a jornadas y la
 * experiencia por lo COMPROBADO («Estoy aquí», ir a una jornada, aportar). Nada que no
 * exista: una promesa de más aquí es una cuenta que se abre y se abandona.
 *
 * Servidor entero salvo el recorrido. Las cifras y el mapa salen de la misma lista
 * cacheada 30 min que usa `/organizaciones`: una consulta, y los números cuadran con el
 * dibujo.
 */

export const metadata: Metadata = (() => {
  const t = translator(LANGUAGE.default);
  const title = `${t("home.titleNeed")} ${t("home.titleGive")}`;
  const description = t("home.lead", { platform: BRAND.platform, country: COUNTRY.name });
  return {
    // Sin la marca: la plantilla del layout ya la añade.
    title,
    description,
    alternates: { canonical: "/inicio" },
    openGraph: { title, description },
  };
})();

const TOUR = [
  { k: "near", icon: Icon.target, Screen: NearScreen },
  { k: "needs", icon: Icon.box, Screen: NeedsScreen },
  { k: "join", icon: Icon.users, Screen: JoinScreen },
  { k: "level", icon: Icon.spark, Screen: LevelScreen },
] as const;

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The hub has its own landing, and a clone may not want a gate at all. Either way the
  // map is the right place to be, and /inicio must not become a dead end.
  if (IS_HUB || !FEATURES.entryPage) redirect("/");

  const params = await searchParams;
  const raw = params.lang;
  const lang = resolveLang(Array.isArray(raw) ? raw[0] : raw);
  const t = translator(lang);

  const withLang = (path: string) =>
    lang === LANGUAGE.default ? path : `${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;
  // Links into the app. `a=` is the action the map opens with (see `app/page.tsx`).
  const app = (action?: "needs" | "initiative") => withLang(action ? `/?a=${action}` : "/");

  const emergency = await currentEmergency();
  const directory = await fetchDirectory(emergency?.id ?? null);
  const map = dotMap(directory, COUNTRY.geo, new Set());

  // El zoom de la portada: hasta donde está pasando la emergencia, si hay una en curso.
  // Sin emergencia (o archivada) se queda el país entero: HelpMaps es un puente de siempre
  // y la emergencia es un modo encima. `ZOOM` es poco a propósito: tiene que seguir
  // leyéndose la silueta del país (a 3,4 aumentos ya no se distinguía Venezuela).
  const ZOOM = 1.8;
  const focus =
    map && emergency && emergency.status !== "archived"
      ? emergencyFocus(directory, COUNTRY.geo, emergency.id, emergency.zones)
      : null;
  // El zoom crece ALREDEDOR del foco: `--fx/--fy` es dónde cae dentro del dibujo, en %.
  // Así el foco no se mueve de sitio y el resto del país se derrama hacia fuera, por todo
  // el fondo de la portada (`inicio.css`). El rótulo usa los mismos porcentajes.
  const zoom = (() => {
    if (!map || !focus) return null;
    const [minX, minY, w, h] = map.viewBox.split(" ").map(Number) as [number, number, number, number];
    return {
      ["--fx" as string]: `${(((focus.x - minX) / w) * 100).toFixed(2)}%`,
      ["--fy" as string]: `${(((focus.y - minY) / h) * 100).toFixed(2)}%`,
      ["--zs" as string]: ZOOM,
    };
  })();
  const total = directory.length.toLocaleString(lang);

  // Only a figure we actually have: a "0" on a landing page reads as failure. Ordered by
  // the map's own type order and capped so the grid stays 2×2.
  const counts = new Map<LocationType, number>();
  for (const d of directory) counts.set(d.type, (counts.get(d.type) ?? 0) + 1);
  const stats = enabledTypes()
    .map((type: LocationType) => ({ type, n: counts.get(type) ?? 0 }))
    .filter((s) => s.n > 0)
    .slice(0, 4);

  return (
    <main className="olp ilp">
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
        <Link href={withLang("/login")} className="olp-toplink ilp-login">
          <Icon.user width={16} height={16} />
          {t("home.login")}
        </Link>
      </header>

      {/* La franja de la portada: de borde a borde y recorta lo que el zoom derrama, para
          que el mapa llene el fondo sin crear scroll lateral ni tapar lo que sigue. */}
      <div className={zoom ? "ilp-band ilp-band-zoom" : "ilp-band"}>
      <section className="olp-hero">
        <div className="olp-copy">
          {/* Las dos preguntas: la portada les habla a los dos lados del puente a la vez. */}
          <h1 className="olp-h1 ilp-h1">
            <span>{t("home.titleNeed")}</span> <span>{t("home.titleGive")}</span>
          </h1>
        </div>

        {map ? (
          <figure className="olp-map ilp-map">
            {/* El escenario: recorta el zoom y funde los bordes. La proporción la da el
                propio encuadre del país, así el hueco está reservado antes de pintar. */}
            <div
              className={zoom ? "ilp-stage ilp-stage-zoom" : "ilp-stage"}
              style={{ aspectRatio: map.viewBox.split(" ").slice(2).join(" / "), ...zoom }}
            >
              <svg
                viewBox={map.viewBox}
                role="img"
                aria-label={t("home.mapLabel", { n: total })}
                preserveAspectRatio="xMidYMid meet"
              >
                {map.outline ? (
                  <defs>
                    <pattern id="ilp-grain" width="2.6" height="2.6" patternUnits="userSpaceOnUse">
                      <circle cx="1.3" cy="1.3" r="0.5" />
                    </pattern>
                  </defs>
                ) : null}
                {/* El país y sus puntos. El zoom va sobre el SVG entero (`.ilp-stage-zoom > svg`). */}
                <g>
                  {map.outline ? (
                    <path className="olp-land" d={map.outline} fill="url(#ilp-grain)" />
                  ) : null}
                  <g className="olp-dots">
                    {map.dots.map((d) => (
                      <circle
                        key={`${d.x}:${d.y}`}
                        cx={d.x}
                        cy={d.y}
                        r={0.52}
                        // El turno en que brota, como variable: `inicio.css` le suma una
                        // segunda animación (encogerse con el zoom) con su propio retraso.
                        style={{ ["--d" as string]: `${(d.k * 0.14).toFixed(2)}s` }}
                      />
                    ))}
                  </g>
                  {zoom
                    ? null
                    : map.pings.map((p, i) => (
                        <circle
                          key={`p${i}`}
                          className="olp-ping"
                          cx={p.x}
                          cy={p.y}
                          r={3}
                          style={{ animationDelay: `${2 + i * 1.1}s` }}
                        />
                      ))}
                </g>
              </svg>

              {/* Al terminar el zoom: el foco late en el centro y se rotula. Va en HTML y
                  no dentro del SVG para que no crezca con el zoom. */}
              {zoom && emergency ? (
                <Link href={app()} className="ilp-focus">
                  <span className="ilp-focus-ring" aria-hidden="true" />
                  <span className="ilp-focus-tag">
                    <span className="ilp-focus-live" aria-hidden="true" />
                    <span className="ilp-focus-txt">
                      <b>{emergency.name}</b>
                      {focus?.place ? <span>{regionLabel(focus.place)}</span> : null}
                    </span>
                    <Icon.chevron width={16} height={16} aria-hidden="true" />
                  </span>
                </Link>
              ) : null}
            </div>
            {/* La leyenda: la cifra en grande y en vivo. Arriba en el teléfono (abajo la
                tapa la tarjeta de las puertas), abajo a la izquierda en escritorio. */}
            <figcaption className="ilp-cap">
              <span className="ilp-cap-live" aria-hidden="true" />
              <b className="ilp-cap-n">{total}</b>
              <span className="ilp-cap-l">{t("home.mapCount")}</span>
            </figcaption>
          </figure>
        ) : null}

        {/* La acción de la página: entrar, con cuenta o sin ella. El titular ya hace las dos
            preguntas («¿necesitas…? ¿quieres…?»); esto es cómo se entra a responderlas. Crear
            cuenta es la principal (es lo que convierte), pero entrar sin ella está al mismo
            nivel de vista: a nadie que busca un refugio se le pone una puerta delante. En el
            teléfono, apilados y a lo ancho (el pulgar); en escritorio, en fila. */}
        <nav className="olp-find ilp-doors" aria-labelledby="ilp-doors-h">
          <h2 id="ilp-doors-h" className="olp-sr">
            {t("home.doorsTitle")}
          </h2>
          <div className="ilp-ctas">
            <Link href={withLang("/registro")} className="ilp-cta ilp-cta-main">
              <Icon.user width={20} height={20} aria-hidden="true" />
              <span>{t("home.createAccount")}</span>
              <Icon.chevron width={18} height={18} className="ilp-cta-go" aria-hidden="true" />
            </Link>
            <Link href={app()} className="ilp-cta ilp-cta-alt">
              <Icon.search width={20} height={20} aria-hidden="true" />
              <span>{t("home.enterAnon")}</span>
              <Icon.chevron width={18} height={18} className="ilp-cta-go" aria-hidden="true" />
            </Link>
          </div>
          {/* La explicación va DESPUÉS de los botones: pregunta, acción y luego el porqué.
              Quien ya sabe a qué viene no tiene que leer un párrafo para encontrar la puerta. */}
          <p className="olp-lead ilp-lead">
            {t("home.lead", { platform: BRAND.platform, country: COUNTRY.name })}
          </p>
        </nav>
      </section>
      </div>

      {stats.length > 0 ? (
        <section className="olp-band ilp-reveal" aria-labelledby="ilp-stats-h">
          <h2 id="ilp-stats-h" className="ilp-kicker">
            {t("home.statsTitle")}
          </h2>
          <ul className="ilp-stats">
            {stats.map((s, i) => (
              <li key={s.type} className="ilp-stat" style={{ ["--i" as string]: i }}>
                <b className="ilp-stat-n">{s.n.toLocaleString(lang)}</b>
                <span className="ilp-stat-l">{t(`type.${s.type}.plural` as DictKey)}</span>
              </li>
            ))}
          </ul>
          <p className="ilp-stats-note">{t("home.statsNote")}</p>
        </section>
      ) : null}

      {/* El puente: las organizaciones publican y, por el mapa, llegan a los dos lados.
          Es la idea de HelpMaps en un dibujo; las líneas «fluyen» de arriba abajo. */}
      <section className="olp-band" aria-labelledby="ilp-bridge-h">
        <h2 id="ilp-bridge-h" className="olp-h2">
          {t("home.bridgeTitle")}
        </h2>
        <p className="olp-sub">{t("home.bridgeLead", { platform: BRAND.platform })}</p>
        <div className="ilp-bridge">
          <div className="ilp-node ilp-node-org ilp-reveal">
            <span className="ilp-node-ic" aria-hidden="true">
              <Icon.volunteer width={22} height={22} />
            </span>
            <h3 className="ilp-node-t">{t("home.bridgeOrgs")}</h3>
            <p className="ilp-node-d">{t("home.bridgeOrgsDesc")}</p>
          </div>
          {/* De las organizaciones al mapa. Las líneas son SVG con el trazo discontinuo
              «fluyendo» hacia las personas: lo que se publica, llega. */}
          <svg className="ilp-link" viewBox="0 0 4 36" preserveAspectRatio="none" aria-hidden="true">
            <path className="ilp-wire-track" d="M2 0 V36" />
            <path className="ilp-wire" d="M2 0 V36" />
          </svg>
          {/* Del mapa a cada lado: sale del centro de la pastilla, va hacia cada columna y
              baja hasta el centro de su tarjeta. El eje x es un porcentaje del ancho (24,4 y
              75,6 son los centros de las dos columnas, con su hueco). */}
          <div className="ilp-junction">
            <svg className="ilp-fork" viewBox="0 0 100 76" preserveAspectRatio="none" aria-hidden="true">
              <path className="ilp-wire-track" d="M50 22 H28.4 Q24.4 22 24.4 30 V76" />
              <path className="ilp-wire-track" d="M50 22 H71.6 Q75.6 22 75.6 30 V76" />
              <path className="ilp-wire" d="M50 22 H28.4 Q24.4 22 24.4 30 V76" />
              <path className="ilp-wire" d="M50 22 H71.6 Q75.6 22 75.6 30 V76" />
            </svg>
          <div className="ilp-hub">
            <span className="ilp-hub-logo" aria-hidden="true">
              {BRAND.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- un asset estático
                <img src={BRAND.logo} alt="" />
              ) : (
                <Icon.target width={18} height={18} />
              )}
            </span>
            {t("home.bridgeHub")}
          </div>
          </div>
          <div className="ilp-people">
            <div className="ilp-node ilp-reveal">
              <span className="ilp-node-ic ilp-node-ic-need" aria-hidden="true">
                <Icon.search width={20} height={20} />
              </span>
              <h3 className="ilp-node-t">{t("home.bridgeNeed")}</h3>
              <p className="ilp-node-d">{t("home.bridgeNeedDesc")}</p>
            </div>
            <div className="ilp-node ilp-reveal">
              <span className="ilp-node-ic ilp-node-ic-give" aria-hidden="true">
                <Icon.heart width={20} height={20} />
              </span>
              <h3 className="ilp-node-t">{t("home.bridgeGive")}</h3>
              <p className="ilp-node-d">{t("home.bridgeGiveDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lo que se puede hacer en HelpMaps, enseñado en un teléfono: cada paso cambia la
          pantalla. Sin hablar de cuentas aquí; eso va en la sección siguiente. */}
      <section className="olp-band" aria-labelledby="ilp-tour-h">
        <h2 id="ilp-tour-h" className="olp-h2">
          {t("home.tourTitle", { platform: BRAND.platform })}
        </h2>
        <p className="olp-sub">{t("home.tourLead")}</p>
        {/* Lo maneja la persona: toca un paso, o usa anterior / siguiente bajo el teléfono. */}
        <FeatureTour
          manual={{ prev: t("home.tourPrev"), next: t("home.tourNext") }}
          steps={TOUR.map(({ k, icon: Glyph, Screen }) => ({
            key: k,
            icon: <Glyph width={20} height={20} />,
            title: t(`home.f.${k}` as DictKey),
            desc: t(`home.f.${k}Desc` as DictKey),
            screen: <Screen t={t} />,
          }))}
        />
        <p className="olp-demo-note">{t("home.demo.note")}</p>
      </section>

      {/* Sin cuenta o con ella: las dos salidas, lado a lado. La de la cuenta es la única
          tarjeta en tinta, porque es la decisión que esta sección pide. */}
      <section className="olp-band" aria-labelledby="ilp-cmp-h">
        <h2 id="ilp-cmp-h" className="olp-h2">
          {t("home.compareTitle")}
        </h2>
        <div className="ilp-cmp">
          <article className="ilp-plan ilp-reveal">
            <h3 className="ilp-plan-t">{t("home.freeTitle")}</h3>
            <p className="ilp-plan-lead">{t("home.freeLead")}</p>
            <ul className="ilp-list">
              {(["1", "2", "3", "4", "5"] as const).map((n) => (
                <li key={n}>
                  <Icon.check width={18} height={18} aria-hidden="true" />
                  {t(`home.free${n}` as DictKey)}
                </li>
              ))}
            </ul>
            <Link href={app()} className="ilp-btn ilp-btn-ghost">
              <Icon.search width={18} height={18} />
              {t("home.freeCta")}
            </Link>
          </article>

          <article className="ilp-plan ilp-plan-acc ilp-reveal">
            <h3 className="ilp-plan-t">{t("home.accTitle")}</h3>
            <p className="ilp-plan-lead">{t("home.accLead")}</p>
            <ul className="ilp-list">
              {(["1", "2", "3", "4"] as const).map((n) => (
                <li key={n}>
                  <Icon.plus width={18} height={18} aria-hidden="true" />
                  {t(`home.acc${n}` as DictKey)}
                </li>
              ))}
            </ul>
            <Link href={withLang("/registro")} className="ilp-btn ilp-btn-brand">
              <Icon.user width={18} height={18} />
              {t("home.accCta")}
              <Icon.chevron width={18} height={18} className="ilp-btn-go" />
            </Link>
            <p className="ilp-plan-note">{t("home.accNote")}</p>
          </article>
        </div>
      </section>

      {/* Lo que se está reportando: sólo aparece si hay boletín. */}
      <div className="olp-band ilp-news">
        <NewsSection />
      </div>

      {/* Para quien tiene una iniciativa: registrarla, o buscarla si ya está y pedir
          manejarla. Es la puerta de entrada a /organizaciones desde la portada. */}
      <section className="olp-band" aria-labelledby="ilp-org-h">
        <div className="olp-how ilp-org ilp-reveal">
          <span className="olp-feat-ic" aria-hidden="true">
            <Icon.volunteer width={20} height={20} />
          </span>
          <h2 id="ilp-org-h" className="ilp-org-h">
            {t("home.orgTitle")}
          </h2>
          <p className="ilp-org-p">{t("home.orgBody")}</p>
          <div className="ilp-org-acts">
            {FEATURES.suggestions ? (
              <Link href={app("initiative")} className="ilp-btn ilp-btn-ghost">
                <Icon.plus width={18} height={18} />
                {t("entry.campaignCta")}
              </Link>
            ) : null}
            <Link href={withLang("/organizaciones")} className="ilp-btn ilp-btn-ghost">
              <Icon.search width={18} height={18} />
              {t("home.orgFind")}
            </Link>
          </div>
          <p className="olp-cta-note ilp-org-note">{t("entry.campaignFine")}</p>
        </div>
      </section>

      {/* El cierre: la promesa de privacidad en grande, y las dos salidas otra vez. */}
      <section className="olp-promise" aria-labelledby="ilp-promise-h">
        <div className="olp-promise-in">
          <h2 id="ilp-promise-h" className="olp-promise-h">
            {t("home.promiseTitle")}
          </h2>
          <p className="olp-promise-p">{t("home.promiseBody", { brand: BRAND.name })}</p>
          <div className="ilp-promise-acts">
            <Link href={app()} className="ilp-btn ilp-btn-light">
              <Icon.search width={18} height={18} />
              {t("home.freeCta")}
            </Link>
            <Link href={withLang("/registro")} className="ilp-btn ilp-btn-line">
              {t("home.accCta")}
            </Link>
          </div>
        </div>

        <footer className="olp-foot">
          {/* The tagline is written in this deployment's language only. */}
          <span>{lang === LANGUAGE.default && BRAND.tagline ? BRAND.tagline : BRAND.name}</span>
          <Link href={`/docs/privacidad?lang=${lang}`}>{t("footer.privacy")}</Link>
          <Link href={`/docs/terminos?lang=${lang}`}>{t("footer.terms")}</Link>
          <CookiePrefsLink className="olp-foot-cookie" label={t("footer.cookies")} />
          <Link href={`/docs?lang=${lang}`}>{t("footer.about")}</Link>
        </footer>
      </section>
    </main>
  );
}
