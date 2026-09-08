import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchCenter } from "@/data/centers";
import { EMPTY_PROFILE, fetchInitiativeProfile } from "@/data/initiatives";
import {
  daysSince,
  directionsUrl,
  hasCoords,
  isDigital,
  isStale,
  lastTouched,
  statusOf,
} from "@/domain/center";
import { BRAND, COUNTRY, LANGUAGE, MAPCFG, regionLabel } from "@/config";
import { translator, resolveLang } from "@/i18n";
import { telHref, whatsappHref } from "@/features/share/share";
import { coverageLabel, instagramUrl } from "@/features/centers/coverage";
import { typeStyle } from "@/config";
import { Icon, TypeGlyph } from "@/ui/icons";
import {
  ActivityList,
  CampaignList,
  DonateBox,
  PostList,
} from "@/features/centers/InitiativeSections";
import ProfileTabs, { type ProfileTab } from "@/features/centers/ProfileTabs";
import type { DictKey } from "@/i18n";
import { currentEmergencyId } from "@/server/emergency";

/**
 * El perfil público de un punto.
 *
 * ── QUÉ ERA Y QUÉ ES ────────────────────────────────────────────────────────
 *
 * Era una tarjeta: nombre, qué necesita, cuatro enlaces. Existía sólo para que un enlace
 * pegado en WhatsApp abriera con algo antes de arrancar el mapa entero.
 *
 * Ahora es el SITIO de esa iniciativa. Su portada, su foto, lo que hace, sus campañas con
 * la meta a la vista, su agenda y su historial de publicaciones. Es lo que hasta ahora no
 * teníamos: una dirección que una iniciativa puede enseñar a un aliado, a un donante o a
 * su propia comunidad, y que existe aunque quien la abra no haya usado nunca el mapa.
 *
 * ── SIGUE SIENDO `/c/<id>` ──────────────────────────────────────────────────
 *
 * No se estrenó una ruta nueva. Ésta ya lleva tiempo circulando por WhatsApp y ya está
 * indexada: partirla en dos habría dejado la mitad de los enlaces del mundo apuntando a
 * la versión pobre, y a nosotros manteniendo dos páginas que dicen lo mismo.
 *
 * ── SERVIDA DESDE EL SERVIDOR, Y POR ESO ────────────────────────────────────
 *
 * Este URL viaja por mensajería: tiene que generar vista previa del enlace y tiene que
 * abrir con contenido en una conexión que no puede permitirse arrancar el mapa primero.
 *
 * ── SIN COMENTARIOS, A PROPÓSITO ────────────────────────────────────────────
 *
 * Se parece a una red social y le falta lo que define a una: nadie responde. No es una
 * función pendiente. Un hilo abierto bajo la ficha de un refugio hay que moderarlo las
 * veinticuatro horas, y el día que no se modere alguien leerá ahí que ese refugio está
 * lleno cuando no lo está. Lo que se publica lo firma la iniciativa y responde de ello.
 */

export const revalidate = 120;

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const sb = supabasePublic();
  if (!sb) return { title: BRAND.name };
  const center = await fetchCenter(sb, id, await currentEmergencyId()).catch(() => null);
  if (!center) return { title: BRAND.name };

  const place = isDigital(center)
    ? coverageLabel(center, regionLabel, translator(LANGUAGE.default))
    : [center.municipality, regionLabel(center.region)].filter(Boolean).join(", ");
  const need = center.info?.needs?.trim();
  const description = need ? `Necesita: ${need}` : `${place || COUNTRY.name} · ${BRAND.tagline}`;

  // La portada hace de imagen del enlace. Es lo que convierte un enlace pegado en un chat
  // en algo que alguien abre: sin imagen, un enlace compartido es una línea de texto gris.
  const profile = await fetchInitiativeProfile(sb, id).catch(() => EMPTY_PROFILE);
  const image = profile.images.banner ?? profile.images.photo ?? undefined;

  return {
    title: center.name,
    description,
    openGraph: {
      title: center.name,
      description,
      type: "profile",
      images: image ? [image] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: center.name,
      description,
      images: image ? [image] : undefined,
    },
    alternates: { canonical: `/c/${center.id}` },
  };
}

export default async function CenterPage({ params, searchParams }: Params) {
  const { id } = await params;
  const query = await searchParams;
  const lang = resolveLang(one(query.lang));
  const t = translator(lang);

  const sb = supabasePublic();
  if (!sb) notFound();
  const center = await fetchCenter(sb, id, await currentEmergencyId()).catch(() => null);
  if (!center) notFound();

  const profile = await fetchInitiativeProfile(sb, id).catch(() => EMPTY_PROFILE);
  const { campaigns, activities, posts, donate, images } = profile;
  const hayAporte = Boolean(donate.info || donate.url);

  const status = statusOf(center);
  const digital = isDigital(center);
  // A digital initiative has no place: the meta line says where it helps instead.
  const place = digital
    ? coverageLabel(center, regionLabel, t)
    : [center.municipality, regionLabel(center.region)].filter(Boolean).join(", ");
  const staleDays = daysSince(lastTouched(center));
  const style = typeStyle(center.type);

  // Un enlace del feed apunta a una publicación concreta. Abrir en «Información» sería
  // aterrizar donde lo que te trajo no está.
  const alPost = Boolean(one(query.post));
  const inicial = alPost ? "posts" : one(query.tab);

  const info = center.info;

  const tabs: ProfileTab[] = [
    {
      id: "info",
      label: t("tab.info"),
      count: null,
      content: (
        <>
          {info?.needs ? (
            <div className="dneed">
              <span className="dneed-l">{t("center.needsTitle")}</span>
              <p className="dneed-t">{info.needs}</p>
            </div>
          ) : null}

          {info?.description ? <p className="sdesc">{info.description}</p> : null}

          {info && info.receives.length > 0 ? (
            <>
              <h3 className="dsection">{t("center.receivesTitle")}</h3>
              <div className="dtags">
                {info.receives.map((r) => (
                  <span key={r} className="dtag">
                    {r}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          <div className="drows">
            <div className="drow">
              <span className="dlabel">{t("form.type")}</span>
              <span className="dval">{t(`type.${center.type}` as DictKey)}</span>
            </div>
            {place ? (
              <div className="drow">
                <span className="dlabel">{t("form.region")}</span>
                <span className="dval">{place}</span>
              </div>
            ) : null}
            {center.address && !digital ? (
              <div className="drow">
                <span className="dlabel">{t("form.address")}</span>
                <span className="dval">{center.address}</span>
              </div>
            ) : null}
            {info?.schedule ? (
              <div className="drow">
                <span className="dlabel">{t("center.scheduleTitle")}</span>
                <span className="dval">{info.schedule}</span>
              </div>
            ) : null}
            {info?.category ? (
              <div className="drow">
                <span className="dlabel">{t("center.categoryTitle")}</span>
                <span className="dval">{info.category}</span>
              </div>
            ) : null}
            {center.phone ? (
              <div className="drow">
                <span className="dlabel">{t("center.call")}</span>
                <span className="dval">
                  <a href={telHref(center.phone)}>{center.phone}</a>
                </span>
              </div>
            ) : null}
            {info?.website ? (
              <div className="drow">
                <span className="dlabel">{t("center.website")}</span>
                <span className="dval">
                  <a href={info.website} target="_blank" rel="noopener noreferrer">
                    {info.website.replace(/^https?:\/\//, "")}
                  </a>
                </span>
              </div>
            ) : null}
            {info?.instagram ? (
              <div className="drow">
                <span className="dlabel">{t("center.instagram")}</span>
                <span className="dval">
                  <a href={instagramUrl(info.instagram)} target="_blank" rel="noopener noreferrer">
                    @{info.instagram}
                  </a>
                </span>
              </div>
            ) : null}
          </div>

          <p className="prof-note">{t("center.disclaimer")}</p>
        </>
      ),
    },
  ];

  if (campaigns.length > 0 || hayAporte) {
    tabs.push({
      id: "campaigns",
      label: t("tab.campaigns"),
      count: campaigns.length || null,
      content: (
        <>
          {campaigns.length > 0 ? <CampaignList campaigns={campaigns} /> : null}
          {hayAporte ? <DonateBox donate={donate} locationId={center.id} /> : null}
        </>
      ),
    });
  }

  if (activities.length > 0) {
    tabs.push({
      id: "agenda",
      label: t("tab.agenda"),
      count: activities.length,
      content: <ActivityList activities={activities} />,
    });
  }

  if (posts.length > 0) {
    tabs.push({
      id: "posts",
      label: t("tab.posts"),
      count: posts.length,
      content: <PostList posts={posts} campaigns={campaigns} />,
    });
  }

  return (
    /* La página, no sólo la ficha.
       En una pantalla ancha, una columna de 720px sobre blanco infinito se lee como un
       documento a medio maquetar: no se sabe dónde acaba el contenido y dónde empieza el
       hueco. Con el fondo apagado detrás, la columna pasa a ser una TARJETA con principio
       y final, y el vacío de abajo deja de ser un error para ser el margen de la página. */
    <div className="profpage">
      <main className="prof">
      {/* La portada. Sin imagen no se deja un hueco gris: se pinta un degradado del color
          del tipo de punto, que es el mismo que lleva su pin en el mapa. Un perfil sin
          rellenar tiene que verse acabado, no roto — es el estado en el que va a estar la
          mayoría el día que esto se abra. */}
      <div
        className={`prof-cover${images.banner ? " prof-cover-img" : ""}`}
        style={
          images.banner
            ? { backgroundImage: `url(${JSON.stringify(images.banner)})` }
            : { ["--tc" as string]: style.color }
        }
      >
        {/* Sólo el chevron; el nombre viaja en `aria-label`. Ver la nota de `.prof-back`. */}
        <Link className="prof-back" href="/" aria-label={BRAND.name}>
          <Icon.back />
        </Link>
      </div>

      <div className="prof-body">
        <div className="prof-id">
          <span className="prof-photo" style={{ color: style.color }}>
            {images.photo ? (
              // Sin `next/image`: la URL sale del bucket que cada país configura por su
              // cuenta, y un dominio no declarado en `next.config.ts` tumbaría el render
              // de la página entera en vez de dejar una foto rota.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images.photo} alt="" />
            ) : (
              <TypeGlyph name={style.icon} size={40} />
            )}
          </span>
          <h1 className="prof-name">{center.name}</h1>
          <p className="prof-meta">
            {t(`type.${center.type}` as DictKey)}
            {place ? ` · ${place}` : ""}
          </p>
          <span className={`prof-status prof-status-${status ?? "unknown"}`}>
            {status ? t(`status.${status}`) : t("status.unknown")}
          </span>
        </div>

        {/* El aviso va ANTES que nada: que el punto siga existiendo pesa más que lo que
            esté pidiendo. */}
        {status === "cerrado" ? (
          <p className="prof-warn">{t("status.closedWarning")}</p>
        ) : status === "lleno" ? (
          <p className="prof-warn">{t("status.fullWarning")}</p>
        ) : isStale(center) ? (
          <p className="prof-warn">
            {t("status.staleWarning", { n: staleDays ?? MAPCFG.staleAfterDays })}
          </p>
        ) : null}

        <div className="dactions">
          {hasCoords(center) && !digital ? (
            <a
              className="btnp"
              href={directionsUrl(center)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon.directions />
              {t("center.directions")}
            </a>
          ) : null}
          {center.whatsapp ? (
            <a
              className="btng"
              href={whatsappHref(center.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon.whatsapp />
              {t("center.whatsapp")}
            </a>
          ) : null}
          {center.phone ? (
            <a className="btng" href={telHref(center.phone)}>
              <Icon.phone />
              {t("center.call")}
            </a>
          ) : null}
          {/* Al mapa, con este punto ya abierto: quien llegó por un enlace y quiere ver
              qué hay alrededor no debería tener que buscarlo otra vez. */}
          <Link className="btng" href={`/?c=${center.id}`}>
            <Icon.target />
            {t("entry.enter")}
          </Link>
        </div>

        <ProfileTabs tabs={tabs} initial={inicial} />
      </div>
    </main>

    {/* El pie cierra la página y dice de dónde sale esto. Sin él, quien llega por un
        enlace compartido no tiene forma de saber que hay un mapa detrás — que es
        exactamente la persona a la que le interesa saberlo. */}
    <footer className="proffoot">
      <Link href="/">{BRAND.name}</Link>
      <span>·</span>
      <Link href="/docs/privacidad">{t("footer.privacy")}</Link>
      <span>·</span>
      <Link href="/docs/terminos">{t("footer.terms")}</Link>
    </footer>
    </div>
  );
}
