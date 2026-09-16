"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Center, CenterStatus } from "@/domain/types";
import { toCenterStatus } from "@/domain/types";
import { hasHours } from "@/domain/hours";
import {
  clearProfileImage,
  fetchClaimsForLocation,
  resolveClaim,
  saveCampaign,
  saveCenterProfile,
  uploadProfileImage,
  type CenterProfile,
  type DonationClaim,
  type InitiativeProfile,
} from "@/data/initiatives";
import { typeStyle } from "@/config";
import { Icon, TypeGlyph } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";
import { imageSize } from "@/lib/image";
import type { Translate } from "@/i18n";
import { useSiteHelpers } from "@/features/app/SiteProvider";
import ProfileTabs, { type ProfileTab } from "@/features/centers/ProfileTabs";
import {
  ActivityList,
  CalendarChoices,
  CampaignCard,
  DonateBox,
  PostList,
} from "@/features/centers/InitiativeSections";
import type { Activity } from "@/domain/types";
import type { CalendarEvent } from "@/lib/calendar";
import { fetchAttendeeNames } from "@/data/events";
import { ActivityForm, CampaignForm, CampaignImagePicker, Field, PostForm } from "./forms";
import { InfoSections, type SectionId } from "./ProfileSections";
import OrgSettings from "./OrgSettings";

type Mode = "edit" | "view";
type Composer = "post" | "campaign" | "event" | null;

/**
 * El perfil de la organización, visto desde dentro.
 *
 * ── LA IDEA ────────────────────────────────────────────────────────────────
 *
 * Quien gestiona una iniciativa entra a SU página, la misma que ve el público, y la arregla
 * donde está: toca la portada para cambiarla, el lápiz del horario para corregirlo, «¿Qué
 * hay de nuevo?» para publicar. Es la forma en que cualquiera ya sabe manejar su perfil de
 * una red social, y por eso no hace falta explicarla.
 *
 * Lo que hace una organización en HelpMaps cabe en esa página: sus campañas de donación, su
 * agenda de eventos, lo que cuenta que hizo y cómo contactarla. Lo que NO es contenido —el
 * QR, los aportes que esperan respuesta, el enlace para compartir— va a la configuración,
 * detrás del engranaje, para que la página no se llene de herramientas.
 *
 * «Vista pública» quita los lápices y los huecos vacíos: es exactamente lo que verá un
 * donante, sin tener que salir a mirarlo.
 *
 * ── EL ORDEN DE ARRIBA ─────────────────────────────────────────────────────
 *
 * Debajo del nombre, el estado —abierto, lleno, cerrado— a un toque: es el dato que más
 * rápido envejece y el que manda a alguien a cruzar la ciudad. Luego las tres acciones de
 * cada día. El resto se explora en las pestañas.
 */
export default function ProfileEditor({
  center,
  profile,
  content,
  onSaved,
}: {
  center: Center;
  profile: CenterProfile;
  content: InitiativeProfile;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const helpers = useSiteHelpers();
  const [mode, setMode] = useState<Mode>("edit");
  const [screen, setScreen] = useState<"profile" | "settings">("profile");
  const [tab, setTab] = useState("info");
  const [composer, setComposer] = useState<Composer>(null);
  const [editing, setEditing] = useState<SectionId | null>(null);
  const [createdEvent, setCreatedEvent] = useState<CalendarEvent | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const editable = mode === "edit";
  const style = typeStyle(center.type);
  const place = [center.municipality, helpers.regionLabel(center.region)].filter(Boolean).join(", ");

  // Los aportes que esperan respuesta. Se cargan aquí y no en la configuración porque el
  // engranaje lleva su número: alguien que declaró un aporte está esperando, y eso tiene
  // que verse sin entrar a buscarlo.
  const [claims, setClaims] = useState<DonationClaim[]>([]);
  const [vueltaClaims, setVueltaClaims] = useState(0);
  const recargarClaims = useCallback(() => setVueltaClaims((v) => v + 1), []);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void fetchClaimsForLocation(sb, center.id).then((c) => {
      if (vivo) setClaims(c.filter((x) => x.status === "pending"));
    });
    return () => {
      vivo = false;
    };
  }, [center.id, vueltaClaims]);

  async function resolver(id: string, status: "confirmed" | "rejected") {
    const sb = getSupabase();
    if (!sb) return;
    try {
      await resolveClaim(sb, id, status);
      recargarClaims();
    } catch {
      /* la fila se queda como estaba; reintentar es un toque */
    }
  }

  /** Una acción rápida: a su pestaña, con el formulario ya abierto y a la vista. */
  function start(next: Exclude<Composer, null>) {
    setTab(next === "post" ? "posts" : next === "campaign" ? "campaigns" : "agenda");
    setComposer(next);
    setEditing(null);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() =>
      tabsRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
    );
  }

  function published() {
    setComposer(null);
    onSaved();
  }

  if (screen === "settings") {
    return (
      <OrgSettings
        center={center}
        claims={claims}
        onResolve={resolver}
        onBack={() => setScreen("profile")}
      />
    );
  }

  const { campaigns, activities, posts, donate } = content;
  const hayAporte = Boolean(donate.info || donate.url);

  const tabs: ProfileTab[] = [
    {
      id: "info",
      label: t("tab.info"),
      count: null,
      content: (
        <InfoSections
          center={center}
          profile={profile}
          editable={editable}
          editing={editing}
          setEditing={setEditing}
          onSaved={onSaved}
        />
      ),
    },
  ];

  if (editable || campaigns.length > 0 || hayAporte) {
    tabs.push({
      id: "campaigns",
      label: t("tab.campaigns"),
      count: campaigns.length || null,
      content: (
        <div className="ptab-body">
          {editable ? (
            composer === "campaign" ? (
              <ComposerCard title={t("pedit.newCampaign")} onCancel={() => setComposer(null)}>
                <CampaignForm locationId={center.id} onSaved={published} />
              </ComposerCard>
            ) : (
              <button type="button" className="pedit-new" onClick={() => setComposer("campaign")}>
                <Icon.plus />
                {t("pedit.newCampaign")}
              </button>
            )
          ) : null}
          {campaigns.map((c) => (
            <div key={c.id} className="pedit-camp">
              <CampaignCard campaign={c} />
              {editable ? <CampaignManage campaign={c} onSaved={onSaved} /> : null}
            </div>
          ))}
          {editable && campaigns.length === 0 && composer !== "campaign" ? (
            <p className="pedit-none">{t("pedit.noCampaigns")}</p>
          ) : null}
          {!editable && hayAporte ? <DonateBox donate={donate} locationId={center.id} /> : null}
        </div>
      ),
    });
  }

  if (editable || activities.length > 0) {
    tabs.push({
      id: "agenda",
      label: t("tab.agenda"),
      count: activities.length || null,
      content: (
        <div className="ptab-body">
          {editable ? (
            composer === "event" ? (
              <ComposerCard title={t("pedit.newEvent")} onCancel={() => setComposer(null)}>
                <ActivityForm
                  locationId={center.id}
                  onSaved={(ev) => {
                    setCreatedEvent(ev);
                    published();
                  }}
                />
              </ComposerCard>
            ) : (
              <button type="button" className="pedit-new" onClick={() => setComposer("event")}>
                <Icon.plus />
                {t("pedit.newEvent")}
              </button>
            )
          ) : null}
          {/* Recién publicado: la organización también se lo lleva a su calendario. */}
          {editable && createdEvent ? (
            <section className="pedit-created" role="status">
              <div className="ecard-head">
                <h3 className="ecard-title">
                  <Icon.check />
                  {t("event.created")}
                </h3>
                <button
                  type="button"
                  className="ecard-edit"
                  onClick={() => setCreatedEvent(null)}
                  aria-label={t("common.close")}
                  title={t("common.close")}
                >
                  <Icon.close />
                </button>
              </div>
              <p className="ecard-text">{createdEvent.title}</p>
              <CalendarChoices event={createdEvent} />
            </section>
          ) : null}
          {activities.length > 0 ? (
            <ActivityList
              activities={activities}
              where={center.address}
              extra={editable ? (a) => <Attendees activity={a} /> : undefined}
            />
          ) : editable && composer !== "event" ? (
            <p className="pedit-none">{t("pedit.noEvents")}</p>
          ) : null}
        </div>
      ),
    });
  }

  if (editable || posts.length > 0) {
    tabs.push({
      id: "posts",
      label: t("tab.posts"),
      count: posts.length || null,
      content: (
        <div className="ptab-body">
          {editable ? (
            composer === "post" ? (
              <ComposerCard title={t("pedit.composer")} onCancel={() => setComposer(null)}>
                <PostForm locationId={center.id} campaigns={campaigns} onSaved={published} />
              </ComposerCard>
            ) : (
              // El compositor de cualquier red: tu foto y una línea que invita a escribir.
              <button type="button" className="pedit-composer" onClick={() => setComposer("post")}>
                <span className="pedit-composer-av" style={{ color: style.color }}>
                  {content.images.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- bucket por país
                    <img src={content.images.photo} alt="" />
                  ) : (
                    <TypeGlyph name={style.icon} size={18} />
                  )}
                </span>
                <span className="pedit-composer-q">{t("pedit.composer")}</span>
                <Icon.camera />
              </button>
            )
          ) : null}
          {posts.length > 0 ? (
            <PostList posts={posts} campaigns={campaigns} />
          ) : editable && composer !== "post" ? (
            <p className="pedit-none">{t("pedit.noPosts")}</p>
          ) : null}
        </div>
      ),
    });
  }

  return (
    <div className="pedit">
      {/* Sin botón de volver: la cabecera del panel ya trae el suyo, justo encima. */}
      <div className="pedit-bar">
        <div className="pedit-mode" role="group" aria-label={t("pedit.mode")}>
          <button
            type="button"
            className={`pedit-modeb${editable ? " pedit-modeb-on" : ""}`}
            aria-pressed={editable}
            onClick={() => setMode("edit")}
          >
            <Icon.pencil />
            {t("pedit.modeEdit")}
          </button>
          <button
            type="button"
            className={`pedit-modeb${!editable ? " pedit-modeb-on" : ""}`}
            aria-pressed={!editable}
            onClick={() => {
              setMode("view");
              setEditing(null);
              setComposer(null);
            }}
          >
            <Icon.eye />
            {t("pedit.modeView")}
          </button>
        </div>
        <button
          type="button"
          className="pedit-gear"
          onClick={() => setScreen("settings")}
          aria-label={t("pedit.settings")}
          title={t("pedit.settings")}
        >
          <Icon.gear />
          {claims.length > 0 ? <span className="pedit-badge">{claims.length}</span> : null}
        </button>
      </div>

      <ProfileImages center={center} content={content} editable={editable} onSaved={onSaved} />

      <div className="pedit-id">
        <h2 className="prof-name">{center.name}</h2>
        <p className="prof-meta">
          {t(`type.${center.type}` as "type.iniciativa")}
          {place ? ` · ${place}` : ""}
        </p>
        {!editable ? (
          <span className={`prof-status prof-status-${toCenterStatus(profile.status) ?? "unknown"}`}>
            {profile.status ? t(`status.${toCenterStatus(profile.status) ?? "abierto"}`) : t("status.unknown")}
          </span>
        ) : null}
      </div>

      {editable ? (
        <>
          <StatusBox profile={profile} onSaved={onSaved} />

          {claims.length > 0 ? (
            <button type="button" className="pedit-claims" onClick={() => setScreen("settings")}>
              <Icon.heart />
              <span>{t("claims.title")}</span>
              <b>{claims.length}</b>
              <Icon.chevron />
            </button>
          ) : null}

          <Completeness
            center={center}
            profile={profile}
            content={content}
            onSaved={onSaved}
            onPick={(id) => {
              setTab("info");
              setEditing(id);
            }}
          />

          <div className="pedit-quick">
            <button type="button" className="pedit-q" onClick={() => start("post")}>
              <Icon.pencil />
              {t("pedit.actPost")}
            </button>
            <button type="button" className="pedit-q" onClick={() => start("campaign")}>
              <Icon.heart />
              {t("pedit.actCampaign")}
            </button>
            <button type="button" className="pedit-q" onClick={() => start("event")}>
              <Icon.clock />
              {t("pedit.actEvent")}
            </button>
          </div>
        </>
      ) : null}

      <div ref={tabsRef} className="pedit-tabs">
        <ProfileTabs tabs={tabs} active={tab} onChange={(id) => {
          setTab(id);
          setComposer(null);
        }} />
      </div>
    </div>
  );
}

// ── Portada y foto ─────────────────────────────────────────────────────────

/**
 * La portada y la foto, en su sitio y cambiables tocándolas.
 *
 * Suben al elegir el archivo, sin «guardar» aparte: elegirlo ya es la decisión. Toda imagen
 * pasa por `subirImagen`, que la reduce y la comprime antes de subirla.
 */
function ProfileImages({
  center,
  content,
  editable,
  onSaved,
}: {
  center: Center;
  content: InitiativeProfile;
  editable: boolean;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const style = typeStyle(center.type);
  const [subiendo, setSubiendo] = useState<"banner" | "photo" | null>(null);
  const [fallo, setFallo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const { banner, photo } = content.images;

  async function elegir(kind: "banner" | "photo", file: File | null) {
    const sb = getSupabase();
    if (!sb || !file || subiendo) return;
    setSubiendo(kind);
    setFallo(false);
    setAviso(null);
    try {
      // Se sube igual: el aviso dice cómo va a quedar, no impide ponerla. Una organización
      // sin otra foto a mano prefiere una recortada a ninguna.
      setAviso(await imageAdvice(kind, file, t));
      await uploadProfileImage(sb, center.id, kind, file);
      onSaved();
    } catch {
      setFallo(true);
    } finally {
      setSubiendo(null);
    }
  }

  async function quitar(kind: "banner" | "photo") {
    const sb = getSupabase();
    if (!sb || subiendo) return;
    try {
      await clearProfileImage(sb, center.id, kind);
      onSaved();
    } catch {
      setFallo(true);
    }
  }

  return (
    <>
      {/* En modo edición la portada ENTERA es el botón, y la foto también: es donde toca
          cualquiera que ha cambiado la foto de un perfil. Antes sólo respondían la pastilla
          y el círculo de la cámara, y tocar la imagen no hacía nada.
          «Quitar» va fuera de la etiqueta: un botón dentro de ella abriría el selector. */}
      <div className="pedit-coverwrap">
        {editable ? (
          <label
            className={`pedit-cover pedit-pick prof-cover${banner ? " prof-cover-img" : ""}`}
            style={coverStyle(banner, style.color)}
            aria-label={banner ? t("pedit.changeCover") : t("pedit.addCover")}
          >
            <span className="pedit-imgbtn pedit-cover-cta">
              <Icon.camera />
              {subiendo === "banner" ? t("pedit.uploading") : banner ? t("pedit.changeCover") : t("pedit.addCover")}
            </span>
            <FileInput disabled={subiendo !== null} onPick={(f) => void elegir("banner", f)} />
          </label>
        ) : (
          <div
            className={`pedit-cover prof-cover${banner ? " prof-cover-img" : ""}`}
            style={coverStyle(banner, style.color)}
          />
        )}
        {editable && banner ? (
          <button type="button" className="pedit-imgbtn pedit-cover-remove" onClick={() => void quitar("banner")}>
            {t("pedit.removeImage")}
          </button>
        ) : null}
      </div>

      <div className="pedit-photo-wrap">
        {editable ? (
          <label
            className="prof-photo pedit-photo pedit-pick"
            style={{ color: style.color }}
            aria-label={t("pedit.changePhoto")}
            title={t("pedit.changePhoto")}
          >
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- bucket por país
              <img src={photo} alt="" />
            ) : (
              <TypeGlyph name={style.icon} size={40} />
            )}
            {subiendo === "photo" ? <span className="pedit-photo-busy skel" aria-hidden="true" /> : null}
            <FileInput disabled={subiendo !== null} onPick={(f) => void elegir("photo", f)} />
          </label>
        ) : (
          <span className="prof-photo pedit-photo" style={{ color: style.color }}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- bucket por país
              <img src={photo} alt="" />
            ) : (
              <TypeGlyph name={style.icon} size={40} />
            )}
          </span>
        )}
        {/* La cámara sobresale de la foto: también abre el selector, para que un pulgar
            que cae en la parte que asoma no toque en vacío. */}
        {editable ? (
          <label className="pedit-photo-btn" aria-hidden="true">
            <Icon.camera />
            <FileInput disabled={subiendo !== null} onPick={(f) => void elegir("photo", f)} tabbable={false} />
          </label>
        ) : null}
      </div>

      {editable ? (
        <p className="pedit-imghint">
          <Icon.camera />
          <span>{t("pedit.imgGuide", IMAGE_GUIDE_VARS)}</span>
        </p>
      ) : null}

      {aviso ? (
        <p className="pedit-imgwarn" role="status">
          <Icon.alert />
          <span>{aviso}</span>
        </p>
      ) : null}

      {fallo ? (
        <p className="mine-status-fail" role="status">
          {t("mine.imageFail")}
        </p>
      ) : null}
    </>
  );
}

/**
 * Las medidas que se recomiendan, sacadas de cómo se VEN las imágenes y no de una costumbre.
 *
 * La portada se pinta con `background-size: cover` a unos 2,6:1 en un teléfono (390×150) y
 * a 3,4:1 en escritorio (720×210): 1600×600 llena las dos, y en la ancha se recorta arriba y
 * abajo, por eso lo importante va en la franja del medio. 1600 es además el lado máximo al
 * que `shrinkImage` reduce todo lo que se sube: pedir más no aportaría nada.
 *
 * La foto se ve entre 76 y 92 px con las esquinas redondeadas; a densidad 3 son ~280 px
 * reales. 800 da margen para pantallas mejores, y 400 es el mínimo antes de verse borrosa.
 */
const IMAGE_GUIDE = {
  banner: { w: 1600, h: 600, minW: 1000, ratioMin: 2, ratioMax: 4 },
  photo: { w: 800, h: 800, minW: 400, ratioMin: 0.85, ratioMax: 1.18 },
} as const;

const IMAGE_GUIDE_VARS = {
  cw: IMAGE_GUIDE.banner.w,
  ch: IMAGE_GUIDE.banner.h,
  pw: IMAGE_GUIDE.photo.w,
  ph: IMAGE_GUIDE.photo.h,
};

/** Qué le va a pasar a esta imagen en su sitio, si no encaja. Null si encaja. */
async function imageAdvice(kind: "banner" | "photo", file: File, t: Translate): Promise<string | null> {
  const size = await imageSize(file);
  if (!size || !size.height) return null;
  const g = IMAGE_GUIDE[kind];
  const ratio = size.width / size.height;
  const ideal = { w: g.w, h: g.h };
  if (kind === "banner" && ratio < g.ratioMin) return t("pedit.warnCoverTall", ideal);
  if (kind === "banner" && ratio > g.ratioMax) return t("pedit.warnCoverWide", ideal);
  if (kind === "photo" && (ratio < g.ratioMin || ratio > g.ratioMax)) return t("pedit.warnPhotoShape", ideal);
  if (size.width < g.minW) {
    return t("pedit.warnSmall", { w_: size.width, min: g.minW, ...ideal });
  }
  return null;
}

/** La imagen de portada o, sin ella, el degradado del color del tipo de punto. */
function coverStyle(banner: string | null, color: string): React.CSSProperties {
  return banner ? { backgroundImage: `url(${JSON.stringify(banner)})` } : { ["--tc" as string]: color };
}

function FileInput({
  disabled,
  onPick,
  tabbable = true,
}: {
  disabled: boolean;
  onPick: (file: File | null) => void;
  /** La segunda entrada a la misma foto no debe ser una parada más del tabulador. */
  tabbable?: boolean;
}) {
  return (
    <input
      type="file"
      tabIndex={tabbable ? undefined : -1}
      className="pedit-file"
      accept="image/jpeg,image/png,image/webp"
      disabled={disabled}
      onChange={(e) => {
        onPick(e.target.files?.[0] ?? null);
        // Vaciarlo deja volver a elegir EL MISMO archivo tras un fallo de red.
        e.target.value = "";
      }}
    />
  );
}

// ── Estado de hoy ──────────────────────────────────────────────────────────

const ESTADOS: CenterStatus[] = ["abierto", "lleno", "cerrado"];

/**
 * Abierto / lleno / cerrado, a un toque y sin «guardar»: tocarlo ES guardarlo. Es el gesto
 * que más se repite, y cada paso de más es alguien que lo deja para luego.
 */
function StatusBox({ profile, onSaved }: { profile: CenterProfile; onSaved: () => void }) {
  const { t } = useI18n();
  const [guardando, setGuardando] = useState<CenterStatus | null>(null);
  // Que el fallo SE VEA: quien toca «Lleno» de pie en la puerta no puede irse creyendo que
  // avisó cuando no se guardó.
  const [fallo, setFallo] = useState(false);
  const actual = toCenterStatus(profile.status);

  async function poner(status: CenterStatus) {
    const sb = getSupabase();
    if (!sb || guardando) return;
    setGuardando(status);
    setFallo(false);
    try {
      await saveCenterProfile(sb, { ...profile, status });
      onSaved();
    } catch {
      setFallo(true);
    } finally {
      setGuardando(null);
    }
  }

  return (
    <section className="pedit-status">
      <span className="pedit-label">{t("pedit.status")}</span>
      <div className="mine-status-row">
        {ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            className={`mine-st${actual === e ? ` mine-st-on mine-st-${e}` : ""}`}
            aria-pressed={actual === e}
            disabled={guardando !== null}
            onClick={() => void poner(e)}
          >
            {t(`status.${e}`)}
          </button>
        ))}
      </div>
      {fallo ? <p className="mine-status-fail">{t("mine.statusFail")}</p> : null}
    </section>
  );
}

// ── Lo que le falta al perfil ──────────────────────────────────────────────

/**
 * Cuánto tiene el perfil, y qué es lo siguiente que conviene poner.
 *
 * Un contador y UNA sugerencia, no una lista de deberes: siete cosas pendientes a la vez
 * no se empiezan nunca; una sola, con su botón, se hace en el momento. Desaparece cuando
 * el perfil está completo.
 */
function Completeness({
  center,
  profile,
  content,
  onSaved,
  onPick,
}: {
  center: Center;
  profile: CenterProfile;
  content: InitiativeProfile;
  onSaved: () => void;
  onPick: (id: SectionId) => void;
}) {
  const { t } = useI18n();
  const [subiendo, setSubiendo] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  type Item = { done: boolean; label: string; section: SectionId | null; image?: "photo" | "banner" };
  const items: Item[] = [
    { done: Boolean(content.images.photo), label: t("pedit.itemPhoto"), section: null, image: "photo" },
    { done: Boolean(profile.description), label: t("pedit.emptyAbout"), section: "about" },
    { done: hasHours(profile.hours), label: t("pedit.emptyHours"), section: "hours" },
    { done: profile.receives.length > 0, label: t("pedit.emptyReceives"), section: "receives" },
    {
      done: Boolean(profile.contact_name || profile.website || profile.instagram),
      label: t("pedit.emptyContact"),
      section: "contact",
    },
    { done: Boolean(profile.donate_info || profile.donate_url), label: t("pedit.emptyDonate"), section: "donate" },
    { done: Boolean(content.images.banner), label: t("pedit.itemCover"), section: null, image: "banner" },
  ];
  const n = items.filter((i) => i.done).length;
  const next = items.find((i) => !i.done);
  if (!next) return null;

  // Una imagen se sube desde aquí mismo: la sugerencia es el botón, no una indicación de
  // dónde está el botón.
  async function subir(kind: "photo" | "banner", file: File | null) {
    const sb = getSupabase();
    if (!sb || !file) return;
    setSubiendo(true);
    setFallo(false);
    setAviso(null);
    try {
      setAviso(await imageAdvice(kind, file, t));
      await uploadProfileImage(sb, center.id, kind, file);
      onSaved();
    } catch {
      setFallo(true);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <section className="pedit-complete">
      <div className="pedit-complete-head">
        <b>{t("pedit.completeTitle", { n, total: items.length })}</b>
        <span className="pedit-complete-bar" aria-hidden="true">
          <span style={{ width: `${Math.round((n / items.length) * 100)}%` }} />
        </span>
      </div>
      <p className="pedit-complete-hint">{t("pedit.completeHint")}</p>
      {next.image ? (
        <label className="pedit-complete-next">
          <Icon.camera />
          {subiendo ? t("pedit.uploading") : t("pedit.completeNext", { item: next.label })}
          <FileInput disabled={subiendo} onPick={(f) => void subir(next.image!, f)} />
        </label>
      ) : next.section ? (
        <button type="button" className="pedit-complete-next" onClick={() => onPick(next.section!)}>
          <Icon.plus />
          {next.label}
        </button>
      ) : null}
      {next.image ? (
        <p className="pedit-complete-hint">
          {next.image === "photo"
            ? t("pedit.photoGuide", { w: IMAGE_GUIDE.photo.w, h: IMAGE_GUIDE.photo.h })
            : t("pedit.coverGuide", { w: IMAGE_GUIDE.banner.w, h: IMAGE_GUIDE.banner.h })}
        </p>
      ) : null}
      {aviso ? (
        <p className="pedit-imgwarn" role="status">
          <Icon.alert />
          <span>{aviso}</span>
        </p>
      ) : null}
      {fallo ? <p className="mine-status-fail">{t("mine.imageFail")}</p> : null}
    </section>
  );
}

// ── Un formulario de publicar, dentro de su tarjeta ────────────────────────

function ComposerCard({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className="pedit-compose">
      <div className="ecard-head">
        <h3 className="ecard-title">{title}</h3>
        <button type="button" className="ecard-edit" onClick={onCancel} aria-label={t("pedit.cancel")} title={t("pedit.cancel")}>
          <Icon.close />
        </button>
      </div>
      {children}
    </section>
  );
}

// ── Poner al día una campaña ───────────────────────────────────────────────

/**
 * Lo que el gestor hace con una campaña ya publicada: poner al día lo recaudado, o cerrarla.
 *
 * Cerrar pregunta antes y en línea. Cerrada, la campaña sale de la lista para siempre —el
 * panel sólo trae las activas y las alcanzadas— y el botón vivía pegado a «Guardar», que es
 * el gesto que más se repite aquí. Un `confirm()` del sistema se contesta que sí por reflejo.
 */
function CampaignManage({
  campaign,
  onSaved,
}: {
  campaign: InitiativeProfile["campaigns"][number];
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [valor, setValor] = useState(String(campaign.raised_amount));
  const [imagen, setImagen] = useState<string | null>(campaign.image_url);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function guardar(cerrar = false) {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
    setFallo(false);
    try {
      await saveCampaign(sb, {
        id: campaign.id,
        location_id: campaign.location_id,
        title: campaign.title,
        purpose: campaign.purpose,
        goal_amount: campaign.goal_amount,
        goal_unit: campaign.goal_unit,
        raised_amount: Number(valor) || 0,
        ends_on: campaign.ends_on,
        status: cerrar ? "closed" : campaign.status,
        image_url: imagen,
      });
      setAbierto(false);
      setCerrando(false);
      onSaved();
    } catch {
      setFallo(true);
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="pedit-camp-btn" onClick={() => setAbierto(true)}>
        <Icon.pencil />
        {t("pedit.editCampaign")}
      </button>
    );
  }

  return (
    <div className="pedit-camp-edit stack">
      <Field label={t("mine.f.raised")} hint={t("mine.f.raisedHint")}>
        <input className="finput" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
      </Field>
      <CampaignImagePicker
        locationId={campaign.location_id}
        value={imagen}
        onChange={setImagen}
        onBusy={setSubiendo}
      />
      {fallo ? <p className="onb-err">{t("error.generic")}</p> : null}
      {cerrando ? (
        <div className="mine-camp-sure">
          <p className="mine-camp-sure-q">{t("mine.closeSure")}</p>
          <div className="ecard-acts">
            <button type="button" className="btng" onClick={() => setCerrando(false)} disabled={guardando}>
              {t("pedit.cancel")}
            </button>
            <button type="button" className="btng pedit-danger" onClick={() => void guardar(true)} disabled={guardando}>
              {guardando ? t("common.saving") : t("mine.closeYes")}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ecard-acts">
            <button type="button" className="btng" onClick={() => setAbierto(false)} disabled={guardando}>
              {t("pedit.cancel")}
            </button>
            <button type="button" className="btnp" onClick={() => void guardar()} disabled={guardando || subiendo}>
              {guardando ? t("common.saving") : t("common.save")}
            </button>
          </div>
          <button type="button" className="mine-camp-close" onClick={() => setCerrando(true)} disabled={guardando}>
            {t("mine.closeCampaign")}
          </button>
        </>
      )}
    </div>
  );
}

// ── Quién va a un evento ───────────────────────────────────────────────────

/**
 * Cuántos se apuntaron y, al tocar, quiénes: sólo el nombre que cada persona eligió. Es lo
 * que la organización necesita para calcular comida o sillas, y nada más.
 */
function Attendees({ activity }: { activity: Activity }) {
  const { t } = useI18n();
  const [names, setNames] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  async function abrir() {
    const next = !open;
    setOpen(next);
    if (!next || names) return;
    const sb = getSupabase();
    if (!sb) return;
    setNames(await fetchAttendeeNames(sb, activity.id));
  }

  if (activity.going_count === 0) {
    return <span className="iact-count">{t("event.nobodyYet")}</span>;
  }

  return (
    <span className="pedit-att">
      <button type="button" className="pedit-att-btn" aria-expanded={open} onClick={() => void abrir()}>
        <Icon.users />
        {t(activity.going_count === 1 ? "event.goingOne" : "event.goingN", { n: activity.going_count })}
        <Icon.chevron />
      </button>
      {open ? (
        names === null ? (
          <span className="skel pedit-att-skel" aria-hidden="true" />
        ) : (
          <span className="pedit-att-list">
            {names.map((n, i) => (
              <span key={i} className="dtag">
                {n || t("account.noName")}
              </span>
            ))}
          </span>
        )
      ) : null}
    </span>
  );
}
