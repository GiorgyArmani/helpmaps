import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND, COUNTRY, FEATURES, IS_HUB, LANGUAGE, enabledTypes, regionLabel } from "@/config";
import { getDict, resolveLang, translator, type DictKey, type Translate } from "@/i18n";
import type { LocationType } from "@/domain/types";
import { Icon } from "@/ui/icons";
import { currentEmergency } from "@/server/emergency";
import { CookiePrefsLink } from "@/features/consent/CookieConsent";
import AsciiMap from "../organizaciones/AsciiMap";
import { dotMap, emergencyFocus, fetchDirectory, roundedCount } from "../organizaciones/directory";
import FeatureTour from "../organizaciones/FeatureTour";
import { CampaignScreen } from "../organizaciones/Mockups";
import { GetScreen, JoinScreen, LevelScreen, NearScreen, NeedsScreen } from "./Mockups";
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
  // El texto de la portada es el B (decidido el 2026-10-01).
  const title = t("homeB.title");
  const description = t("homeB.lead", { platform: BRAND.platform, country: COUNTRY.name });
  return {
    // Sin la marca: la plantilla del layout ya la añade.
    title,
    description,
    alternates: { canonical: "/inicio" },
    openGraph: { title, description },
  };
})();

// Primero quien necesita ayuda (encontrar y llegar), después quien quiere darla.
const TOUR_A = [
  { k: "near", icon: Icon.target, Screen: NearScreen },
  { k: "get", icon: Icon.directions, Screen: GetScreen },
  { k: "needs", icon: Icon.box, Screen: NeedsScreen },
  { k: "join", icon: Icon.users, Screen: JoinScreen },
  { k: "level", icon: Icon.spark, Screen: LevelScreen },
] as const;

// La variante B añade la donación directa, con la pantalla de campaña de /organizaciones.
const TOUR_B = [
  TOUR_A[0],
  TOUR_A[1],
  TOUR_A[2],
  { k: "donate", icon: Icon.heart, Screen: CampaignScreen },
  TOUR_A[3],
  TOUR_A[4],
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

  // ── DOS TEXTOS PARA COMPARAR ─────────────────────────────────────────────
  // B es el texto de la portada desde el 2026-10-01; A, el anterior, queda en `?v=a` para
  // compararlos. No es un experimento: nadie recibe uno u otro por sorteo ni se mide nada.
  // Con `?v=` en la dirección aparece un selector A | B en una esquina.
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const forced = one(params.v);
  const isB = forced !== "a";
  const switcher = forced === "a" || forced === "b";
  // En B, cada `home.x` busca primero `homeB.x`; lo que B no cambia cae a A. Así las dos
  // variantes son la misma página y sólo difiere el texto (y tres detalles de estructura).
  const dict = getDict(lang);
  const tv: Translate = (key, vars) => {
    if (isB && key.startsWith("home.")) {
      const alt = `homeB.${key.slice(5)}` as DictKey;
      if (alt in dict) return t(alt, vars);
    }
    return t(key, vars);
  };

  const withLang = (path: string) =>
    lang === LANGUAGE.default ? path : `${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;
  // Links into the app. `a=` is the action the map opens with (see `app/page.tsx`).
  const app = (action?: "needs" | "initiative") => withLang(action ? `/?a=${action}` : "/");

  const emergency = await currentEmergency();
  const directory = await fetchDirectory(emergency?.id ?? null);
  const map = dotMap(directory, COUNTRY.geo);
  // El mapa de la portada es arte de píxel en ASCII (`AsciiMap`); `dotMap` da el encuadre.

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
  // En B, la cifra del mapa va redondeada a la centena («+500»), como en /organizaciones.
  const proof = roundedCount(directory.length, lang);

  // La leyenda del mapa: va sobre el mapa en el teléfono y en la columna del texto en
  // escritorio (CSS elige cuál se ve; la otra es `display: none` y no se lee dos veces).
  const capContent = (
    <>
      <span className="ilp-cap-live" aria-hidden="true" />
      <b className="ilp-cap-n">{isB ? proof : total}</b>{" "}
      <span className="ilp-cap-l">{tv("home.mapCount")}</span>
    </>
  );

  // Only a figure we actually have: a "0" on a landing page reads as failure. Ordered by
  // the map's own type order and capped so the grid stays 2×2.
  const counts = new Map<LocationType, number>();
  for (const d of directory) counts.set(d.type, (counts.get(d.type) ?? 0) + 1);
  const stats = enabledTypes()
    .map((type: LocationType) => ({ type, n: counts.get(type) ?? 0 }))
    .filter((s) => s.n > 0)
    .slice(0, 4);

  // Las redes del pie: sólo las que el preset trae. Venezuela hoy sólo tiene correo.
  const { email, whatsapp, instagram, repo } = BRAND.contact;
  const socials = [
    email ? { key: "mail", href: `mailto:${email}`, label: t("home.socialEmail"), Glyph: Icon.mail } : null,
    whatsapp ? { key: "wa", href: `https://wa.me/${whatsapp}`, label: "WhatsApp", Glyph: Icon.whatsapp } : null,
    instagram
      ? { key: "ig", href: `https://instagram.com/${instagram}`, label: "Instagram", Glyph: Icon.instagram }
      : null,
    repo ? { key: "code", href: repo, label: t("home.socialCode"), Glyph: Icon.link } : null,
  ].filter((x) => x !== null);

  return (
    <main className="olp ilp">
      {switcher ? (
        <nav className="ilp-ab" aria-label="Versión del texto">
          {(["a", "b"] as const).map((v) => (
            <Link
              key={v}
              href={withLang(`/inicio?v=${v}`)}
              aria-current={(v === "b") === isB ? "page" : undefined}
            >
              {v.toUpperCase()}
            </Link>
          ))}
        </nav>
      ) : null}
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
          {tv("home.login")}
        </Link>
      </header>

      {/* La franja de la portada: de borde a borde y recorta lo que el zoom derrama, para
          que el mapa llene el fondo sin crear scroll lateral ni tapar lo que sigue. */}
      <div className={zoom ? "ilp-band ilp-band-zoom" : "ilp-band"}>
      <section className="olp-hero">
        <div className="olp-copy">
          {/* Las dos preguntas: la portada les habla a los dos lados del puente a la vez. */}
          {isB ? (
            <h1 className="olp-h1 ilp-h1 ilp-h1-b">{t("homeB.title")}</h1>
          ) : (
            <h1 className="olp-h1 ilp-h1">
              <span>{tv("home.titleNeed")}</span> <span>{tv("home.titleGive")}</span>
            </h1>
          )}
        </div>

        {map ? (
          <figure className="olp-map ilp-map">
            {/* El escenario: recorta el zoom y funde los bordes. La proporción la da el
                propio encuadre del país, así el hueco está reservado antes de pintar. */}
            <AsciiMap
              entries={directory}
              viewBox={map.viewBox}
              label={tv("home.mapLabel", { n: total })}
              className={zoom ? "ilp-stage ilp-stage-zoom" : "ilp-stage"}
              style={zoom ?? undefined}
            >
              {/* Ondas de radio desde la emergencia: anillos de `o` que salen del foco. En
                  HTML, para que el navegador las anime sin repintar el mapa. */}
              {zoom ? (
                <div className="ilp-waves" aria-hidden="true">
                  {[0, 1].map((w) => (
                    <span key={w} className="ilp-wave" style={{ ["--w" as string]: w }}>
                      {Array.from({ length: 16 }, (_, i) => (
                        <i key={i} style={{ ["--a" as string]: `${i * 22.5}deg` }}>
                          o
                        </i>
                      ))}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Al terminar el zoom: el foco late en el centro y se rotula. Va en HTML y
                  no dentro del SVG para que no crezca con el zoom. */}
              {zoom && emergency ? (
                <Link href={app()} className="ilp-focus">
                  {/* El foco es un carácter más del mapa, que va cambiando: late en ASCII. */}
                  <span className="ilp-focus-glyph" aria-hidden="true" />
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
            </AsciiMap>
            {/* La leyenda: la cifra en grande y en vivo. En el teléfono, sobre el mapa (abajo
                la tapa la tarjeta de las puertas); en escritorio se oculta y la misma cifra va
                en la columna del texto (`.ilp-cap-side`). */}
            <figcaption className="ilp-cap">{capContent}</figcaption>
          </figure>
        ) : null}

        {/* La acción de la página: entrar, con cuenta o sin ella. El titular ya hace las dos
            preguntas («¿necesitas…? ¿quieres…?»); esto es cómo se entra a responderlas. Crear
            cuenta es la principal (es lo que convierte), pero entrar sin ella está al mismo
            nivel de vista: a nadie que busca un refugio se le pone una puerta delante. En el
            teléfono, apilados y a lo ancho (el pulgar); en escritorio, en fila. */}
        <nav className="olp-find ilp-doors" aria-labelledby="ilp-doors-h">
          <h2 id="ilp-doors-h" className="olp-sr">
            {tv("home.doorsTitle")}
          </h2>
          <div className="ilp-ctas">
            <Link href={withLang("/registro")} className="ilp-cta ilp-cta-main">
              <Icon.user width={20} height={20} aria-hidden="true" />
              <span>{tv("home.createAccount")}</span>
              <Icon.chevron width={18} height={18} className="ilp-cta-go" aria-hidden="true" />
            </Link>
            <Link href={app()} className="ilp-cta ilp-cta-alt">
              <Icon.search width={20} height={20} aria-hidden="true" />
              <span>{tv("home.enterAnon")}</span>
              <Icon.chevron width={18} height={18} className="ilp-cta-go" aria-hidden="true" />
            </Link>
          </div>
          {/* La explicación va DESPUÉS de los botones: pregunta, acción y luego el porqué.
              Quien ya sabe a qué viene no tiene que leer un párrafo para encontrar la puerta. */}
          <p className="olp-lead ilp-lead">
            {tv("home.lead", { platform: BRAND.platform, country: COUNTRY.name })}
          </p>
          {/* En escritorio, la cifra cierra la columna del texto: bajo la bajada, a la vista
              y no perdida en una esquina del mapa. En el teléfono va sobre el mapa. */}
          {map ? <p className="ilp-cap ilp-cap-side">{capContent}</p> : null}
        </nav>
      </section>
      </div>

      {stats.length > 0 ? (
        <section className="olp-band ilp-reveal" aria-labelledby="ilp-stats-h">
          <h2 id="ilp-stats-h" className="ilp-kicker">
            {tv("home.statsTitle")}
          </h2>
          <ul className="ilp-stats">
            {stats.map((s, i) => (
              <li key={s.type} className="ilp-stat" style={{ ["--i" as string]: i }}>
                <b className="ilp-stat-n">{s.n.toLocaleString(lang)}</b>
                <span className="ilp-stat-l">{t(`type.${s.type}.plural` as DictKey)}</span>
              </li>
            ))}
          </ul>
          <p className="ilp-stats-note">{tv("home.statsNote")}</p>
        </section>
      ) : null}

      {/* El puente: las organizaciones publican y, por el mapa, llegan a los dos lados.
          Es la idea de HelpMaps en un dibujo; las líneas «fluyen» de arriba abajo. */}
      <section className="olp-band" aria-labelledby="ilp-bridge-h">
        <h2 id="ilp-bridge-h" className="olp-h2">
          {tv("home.bridgeTitle")}
        </h2>
        <p className="olp-sub">{tv("home.bridgeLead", { platform: BRAND.platform })}</p>
        <div className="ilp-bridge">
          <div className="ilp-node ilp-node-org ilp-reveal">
            <span className="ilp-node-ic" aria-hidden="true">
              <Icon.volunteer width={22} height={22} />
            </span>
            <h3 className="ilp-node-t">{tv("home.bridgeOrgs")}</h3>
            <p className="ilp-node-d">{tv("home.bridgeOrgsDesc")}</p>
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
            {tv("home.bridgeHub")}
          </div>
          </div>
          <div className="ilp-people">
            <div className="ilp-node ilp-reveal">
              <span className="ilp-node-ic ilp-node-ic-need" aria-hidden="true">
                <Icon.search width={20} height={20} />
              </span>
              <h3 className="ilp-node-t">{tv("home.bridgeNeed")}</h3>
              <p className="ilp-node-d">{tv("home.bridgeNeedDesc")}</p>
            </div>
            <div className="ilp-node ilp-reveal">
              <span className="ilp-node-ic ilp-node-ic-give" aria-hidden="true">
                <Icon.heart width={20} height={20} />
              </span>
              <h3 className="ilp-node-t">{tv("home.bridgeGive")}</h3>
              <p className="ilp-node-d">{tv("home.bridgeGiveDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lo que se puede hacer en HelpMaps, enseñado en un teléfono: cada paso cambia la
          pantalla. Sin hablar de cuentas aquí; eso va en la sección siguiente. */}
      <section className="olp-band" aria-labelledby="ilp-tour-h">
        <h2 id="ilp-tour-h" className="olp-h2">
          {tv("home.tourTitle", { platform: BRAND.platform })}
        </h2>
        {isB ? null : <p className="olp-sub">{tv("home.tourLead")}</p>}
        {/* Lo maneja la persona: toca un paso, o usa anterior / siguiente bajo el teléfono. */}
        <FeatureTour
          manual={{ prev: tv("home.tourPrev"), next: tv("home.tourNext") }}
          steps={(isB ? TOUR_B : TOUR_A).map(({ k, icon: Glyph, Screen }) => ({
            key: k,
            icon: <Glyph width={20} height={20} />,
            title: isB ? t(`homeB.f.${k}` as DictKey) : t(`home.f.${k}` as DictKey),
            desc: isB
              ? t(`homeB.f.${k}Desc` as DictKey, { platform: BRAND.platform })
              : t(`home.f.${k}Desc` as DictKey),
            screen: <Screen t={t} />,
          }))}
        />
        <p className="olp-demo-note">{tv("home.demo.note")}</p>
      </section>

      {/* Sin cuenta o con ella: las dos salidas, lado a lado. La de la cuenta es la única
          tarjeta en tinta, porque es la decisión que esta sección pide. */}
      <section className="olp-band" aria-labelledby="ilp-cmp-h">
        <h2 id="ilp-cmp-h" className="olp-h2">
          {tv("home.compareTitle")}
        </h2>
        <div className="ilp-cmp">
          <article className="ilp-plan ilp-reveal">
            <h3 className="ilp-plan-t">{tv("home.freeTitle")}</h3>
            <p className="ilp-plan-lead">{tv("home.freeLead")}</p>
            <ul className="ilp-list">
              {(["1", "2", "3", "4", "5"] as const).map((n) => (
                <li key={n}>
                  <Icon.check width={18} height={18} aria-hidden="true" />
                  {tv(`home.free${n}` as DictKey)}
                </li>
              ))}
            </ul>
            <Link href={app()} className="ilp-btn ilp-btn-ghost">
              <Icon.search width={18} height={18} />
              {tv("home.freeCta")}
            </Link>
          </article>

          <article className="ilp-plan ilp-plan-acc ilp-reveal">
            <h3 className="ilp-plan-t">{tv("home.accTitle")}</h3>
            <p className="ilp-plan-lead">{tv("home.accLead")}</p>
            <ul className="ilp-list">
              {(["1", "2", "3", "4"] as const).map((n) => (
                <li key={n}>
                  <Icon.plus width={18} height={18} aria-hidden="true" />
                  {tv(`home.acc${n}` as DictKey)}
                </li>
              ))}
            </ul>
            <Link href={withLang("/registro")} className="ilp-btn ilp-btn-brand">
              <Icon.user width={18} height={18} />
              {tv("home.accCta")}
              <Icon.chevron width={18} height={18} className="ilp-btn-go" />
            </Link>
            <p className="ilp-plan-note">{tv("home.accNote")}</p>
          </article>
        </div>
      </section>

      {/* Para quien tiene una iniciativa: registrarla, o buscarla si ya está y pedir
          manejarla. Es la puerta de entrada a /organizaciones desde la portada. */}
      <section className="olp-band" aria-labelledby="ilp-org-h">
        <div className="olp-how ilp-org ilp-reveal">
          <h2 id="ilp-org-h" className="ilp-org-h">
            {tv("home.orgTitle")}
          </h2>
          <p className="ilp-org-p">{tv("home.orgBody")}</p>
          {isB ? <p className="ilp-org-p">{t("homeB.orgBody2")}</p> : null}
          <div className="ilp-org-acts">
            {FEATURES.suggestions ? (
              <Link href={app("initiative")} className="ilp-btn ilp-btn-ghost">
                <Icon.plus width={18} height={18} />
                {t("entry.campaignCta")}
              </Link>
            ) : null}
            <Link href={withLang("/organizaciones")} className="ilp-btn ilp-btn-ghost">
              <Icon.search width={18} height={18} />
              {tv("home.orgFind")}
            </Link>
          </div>
          <p className="olp-cta-note ilp-org-note">{isB ? t("homeB.orgFine") : t("entry.campaignFine")}</p>
        </div>
      </section>

      {/* El cierre: la marca, las dos salidas otra vez, y el pie con lo que importa —redes,
          legal, organizaciones—. Las redes salen de `brand.contact`: un país que no tiene
          Instagram simplemente no lo enseña, y añadirlo es una línea en su preset. */}
      <section className="olp-promise ilp-end" aria-labelledby="ilp-end-h">
        <div className="olp-promise-in ilp-end-in">
          <div className="ilp-end-brand">
            <span className="olp-logo" aria-hidden="true">
              {BRAND.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- un asset estático
                <img src={BRAND.logo} alt="" />
              ) : (
                (BRAND.emoji || COUNTRY.code.slice(0, 1))
              )}
            </span>
            <div>
              <h2 id="ilp-end-h" className="ilp-end-name">
                {BRAND.name}
              </h2>
              {/* The tagline is written in this deployment's language only. */}
              {lang === LANGUAGE.default && BRAND.tagline ? (
                <p className="ilp-end-tag">{BRAND.tagline}</p>
              ) : null}
            </div>
          </div>
          <div className="ilp-end-acts">
            <Link href={app()} className="ilp-cta ilp-cta-light">
              <Icon.search width={20} height={20} aria-hidden="true" />
              <span>{tv("home.freeCta")}</span>
            </Link>
            <Link href={withLang("/registro")} className="ilp-cta ilp-cta-ghost">
              <Icon.user width={20} height={20} aria-hidden="true" />
              <span>{tv("home.createAccount")}</span>
            </Link>
          </div>
        </div>

        <footer className="olp-foot ilp-foot">
          {socials.length > 0 ? (
            <ul className="ilp-social">
              {socials.map(({ key, href, label, Glyph }) => (
                <li key={key}>
                  <a
                    href={href}
                    aria-label={label}
                    title={label}
                    {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <Glyph width={20} height={20} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <nav className="ilp-legal" aria-label={tv("home.footNav")}>
            <Link href={withLang("/organizaciones")}>{tv("home.footOrgs")}</Link>
            <Link href={`/docs/privacidad?lang=${lang}`}>{t("footer.privacy")}</Link>
            <Link href={`/docs/terminos?lang=${lang}`}>{t("footer.terms")}</Link>
            <CookiePrefsLink className="olp-foot-cookie" label={t("footer.cookies")} />
            <Link href={`/docs?lang=${lang}`}>{t("footer.about")}</Link>
          </nav>
          <span className="ilp-copy">
            © {new Date().getFullYear()} {BRAND.platform}
          </span>
        </footer>
      </section>
    </main>
  );
}
