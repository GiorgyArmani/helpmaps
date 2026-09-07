"use client";

import { useCallback, useEffect, useState } from "react";
import type { Center } from "@/domain/types";
import {
  EMPTY_PROFILE,
  type CampaignDraft,
  type CenterProfile,
  type InitiativeProfile,
  createPost,
  emptyProfile,
  fetchCenterProfile,
  fetchInitiativeProfile,
  saveActivity,
  saveCampaign,
  saveCenterProfile,
} from "@/data/initiatives";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";
import { BRAND } from "@/config";

/**
 * «Mi iniciativa»: lo que ve quien gestiona un punto.
 *
 * DOS CARAS, Y LA PRIMERA NO ES UN TRÁMITE. Mientras `center_info.onboarded_at` esté
 * vacío se muestra el onboarding; después, el panel de gestión.
 *
 * El onboarding existe porque alguien a quien acaban de dar las llaves de su punto llega
 * con todo en la cabeza —el horario, qué hace falta, por dónde recibe— y ése es el único
 * momento en que lo va a escribir entero. Dejarle entrar a un panel vacío con un botón de
 * «editar perfil» gasta esa oportunidad, y el perfil se queda a medias para siempre.
 *
 * Por eso los pasos guardan según se avanza y no al final: quien se quede a mitad deja
 * escrito lo que ya contestó, y al volver sigue donde estaba en vez de empezar de cero.
 *
 * Va DENTRO del panel del mapa, como todo lo demás. No es una página aparte.
 */
export default function InitiativePanel({
  center,
  onClose,
}: {
  center: Center;
  onClose: () => void;
}) {
  const { t } = useI18n();
  // Si no hay cliente configurado no hay nada que esperar, y el primer render ya lo sabe.
  // Arrancar en `loading: true` y corregirlo desde el efecto dejaba el panel entero en
  // «Cargando…» para siempre — la peor forma posible de decir «esto no está configurado».
  const configurado = getSupabase() !== null;
  const [profile, setProfile] = useState<CenterProfile | null>(() =>
    configurado ? null : emptyProfile(center.id),
  );
  const [content, setContent] = useState<InitiativeProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(configurado);

  // Recargar es pedir OTRA vuelta del efecto, no hacer el trabajo aparte.
  //
  // Tener una función async que escribe estado y llamarla desde el efecto Y desde los
  // formularios daba dos caminos hacia las mismas tres escrituras, y el de guardar no
  // cancelaba nada. Con un contador, la carga vive en un solo sitio —el efecto— y
  // «guardado» sólo dice «vuelve a mirar».
  const [vuelta, setVuelta] = useState(0);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  useEffect(() => {
    const sb = getSupabase();
    // Sin cliente no hay nada que pedir: el estado inicial de arriba ya deja el panel
    // utilizable.
    if (!sb) return;
    let vivo = true;
    void Promise.all([
      fetchCenterProfile(sb, center.id),
      fetchInitiativeProfile(sb, center.id),
    ]).then(([p, c]) => {
      if (!vivo) return;
      setProfile(p ?? emptyProfile(center.id));
      setContent(c);
      setLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, [center.id, vuelta]);

  if (loading) return <p className="empty">{t("common.loading")}</p>;
  if (!profile) return <p className="empty">{t("error.generic")}</p>;

  return (
    <div className="mine">
      <button type="button" className="cdback" onClick={onClose}>
        <Icon.back />
        <span>{t("common.back")}</span>
      </button>

      <div className="mine-head">
        <span className="mine-kicker">{t("mine.kicker")}</span>
        <h2 className="mine-name">{center.name}</h2>
      </div>

      {profile.onboarded_at ? (
        <Manage center={center} profile={profile} content={content} onSaved={recargar} />
      ) : (
        <Onboarding center={center} profile={profile} onDone={recargar} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Onboarding
// ───────────────────────────────────────────────────────────────────────────

const PASOS = 3;

function Onboarding({
  center,
  profile,
  onDone,
}: {
  center: Center;
  profile: CenterProfile;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [paso, setPaso] = useState(1);
  const [borrador, setBorrador] = useState<CenterProfile>(profile);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CenterProfile>(k: K, v: CenterProfile[K]) =>
    setBorrador((b) => ({ ...b, [k]: v }));

  async function avanzar() {
    const sb = getSupabase();
    if (!sb) return;
    const ultimo = paso === PASOS;
    setGuardando(true);
    setError(null);
    try {
      // Se guarda en CADA paso, no sólo al final: quien pierde la señal a mitad —que en
      // este país es lo normal— no puede perder lo que ya escribió.
      await saveCenterProfile(sb, borrador, ultimo);
      if (ultimo) onDone();
      else setPaso((p) => p + 1);
    } catch {
      setError(t("error.generic"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="onb">
      <div className="onb-steps" aria-label={t("onb.stepOf", { n: paso, total: PASOS })}>
        {Array.from({ length: PASOS }, (_, i) => (
          <span key={i} className={`onb-step${i < paso ? " onb-step-on" : ""}`} />
        ))}
      </div>

      {paso === 1 ? (
        <>
          <h3 className="onb-t">{t("onb.s1.title")}</h3>
          <p className="onb-p">{t("onb.s1.body")}</p>
          <Field label={t("onb.f.category")} hint={t("onb.f.categoryHint")}>
            <input
              className="finput"
              value={borrador.category ?? ""}
              onChange={(e) => set("category", e.target.value || null)}
              maxLength={60}
            />
          </Field>
          <Field label={t("onb.f.description")} hint={t("onb.f.descriptionHint")}>
            <textarea
              className="finput"
              rows={4}
              value={borrador.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              maxLength={600}
            />
          </Field>
        </>
      ) : null}

      {paso === 2 ? (
        <>
          <h3 className="onb-t">{t("onb.s2.title")}</h3>
          <p className="onb-p">{t("onb.s2.body")}</p>
          <Field label={t("onb.f.schedule")} hint={t("onb.f.scheduleHint")}>
            <input
              className="finput"
              value={borrador.schedule ?? ""}
              onChange={(e) => set("schedule", e.target.value || null)}
              maxLength={120}
            />
          </Field>
          <Field label={t("onb.f.contact")} hint={t("onb.f.contactHint")}>
            <input
              className="finput"
              value={borrador.contact_name ?? ""}
              onChange={(e) => set("contact_name", e.target.value || null)}
              maxLength={80}
            />
          </Field>
          <Field label={t("onb.f.needs")} hint={t("onb.f.needsHint")}>
            <textarea
              className="finput"
              rows={3}
              value={borrador.needs ?? ""}
              onChange={(e) => set("needs", e.target.value || null)}
              maxLength={400}
            />
          </Field>
        </>
      ) : null}

      {paso === 3 ? (
        <>
          <h3 className="onb-t">{t("onb.s3.title")}</h3>
          <p className="onb-p">{t("onb.s3.body")}</p>
          <Field label={t("onb.f.donateInfo")} hint={t("onb.f.donateInfoHint")}>
            <textarea
              className="finput"
              rows={4}
              value={borrador.donate_info ?? ""}
              onChange={(e) => set("donate_info", e.target.value || null)}
              maxLength={600}
            />
          </Field>
          <Field label={t("onb.f.donateUrl")}>
            <input
              className="finput"
              inputMode="url"
              placeholder="https://"
              value={borrador.donate_url ?? ""}
              onChange={(e) => set("donate_url", e.target.value || null)}
            />
          </Field>
          <Field label={t("onb.f.instagram")}>
            <input
              className="finput"
              value={borrador.instagram ?? ""}
              onChange={(e) => set("instagram", e.target.value.replace(/^@/, "") || null)}
              maxLength={40}
            />
          </Field>

          {/* La regla del dinero, dicha a quien la necesita oír: la plataforma no se pone
              en medio. Va aquí y no sólo en la ficha pública porque es la persona que
              publica los datos de cobro quien tiene que saber a dónde llega el dinero. */}
          <p className="onb-note">
            <Icon.alert />
            {t("onb.moneyNote", { platform: BRAND.platform })}
          </p>
        </>
      ) : null}

      {error ? (
        <p className="onb-err" role="status">
          {error}
        </p>
      ) : null}

      <div className="onb-actions">
        {paso > 1 ? (
          <button type="button" className="btng" onClick={() => setPaso((p) => p - 1)}>
            {t("onb.back")}
          </button>
        ) : null}
        <button type="button" className="btnp" onClick={() => void avanzar()} disabled={guardando}>
          {guardando
            ? t("common.saving")
            : paso === PASOS
              ? t("onb.finish")
              : t("onb.next")}
        </button>
      </div>

      <p className="onb-skip">{t("onb.savedAsYouGo", { name: center.name })}</p>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Gestión, una vez hecho el onboarding
// ───────────────────────────────────────────────────────────────────────────

function Manage({
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
  const [abierto, setAbierto] = useState<"needs" | "campaign" | "activity" | "post" | null>(
    null,
  );

  return (
    <>
      <NeedsBox profile={profile} onSaved={onSaved} open={abierto === "needs"}
        onToggle={() => setAbierto((a) => (a === "needs" ? null : "needs"))} />

      <h3 className="dsection">{t("mine.campaigns")}</h3>
      {content.campaigns.length === 0 ? (
        <p className="mine-none">{t("mine.noCampaigns")}</p>
      ) : (
        content.campaigns.map((c) => (
          <p key={c.id} className="mine-row">
            <span className="mine-row-t">{c.title}</span>
            <span className="mine-row-m">
              {c.raised_amount} / {c.goal_amount} {c.goal_unit}
            </span>
          </p>
        ))
      )}
      <ToggleButton
        label={t("mine.newCampaign")}
        on={abierto === "campaign"}
        onClick={() => setAbierto((a) => (a === "campaign" ? null : "campaign"))}
      />
      {abierto === "campaign" ? (
        <CampaignForm
          locationId={center.id}
          onSaved={() => {
            setAbierto(null);
            onSaved();
          }}
        />
      ) : null}

      <h3 className="dsection">{t("mine.activities")}</h3>
      {content.activities.length === 0 ? (
        <p className="mine-none">{t("mine.noActivities")}</p>
      ) : (
        content.activities.map((a) => (
          <p key={a.id} className="mine-row">
            <span className="mine-row-t">{a.title}</span>
            <span className="mine-row-m">{new Date(a.starts_at).toLocaleString()}</span>
          </p>
        ))
      )}
      <ToggleButton
        label={t("mine.newActivity")}
        on={abierto === "activity"}
        onClick={() => setAbierto((a) => (a === "activity" ? null : "activity"))}
      />
      {abierto === "activity" ? (
        <ActivityForm
          locationId={center.id}
          onSaved={() => {
            setAbierto(null);
            onSaved();
          }}
        />
      ) : null}

      <h3 className="dsection">{t("mine.posts")}</h3>
      <ToggleButton
        label={t("mine.newPost")}
        on={abierto === "post"}
        onClick={() => setAbierto((a) => (a === "post" ? null : "post"))}
      />
      {abierto === "post" ? (
        <PostForm
          locationId={center.id}
          campaigns={content.campaigns}
          onSaved={() => {
            setAbierto(null);
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}

/** Lo que hace falta HOY: es lo que más cambia y lo que más se mira, así que va arriba. */
function NeedsBox({
  profile,
  onSaved,
  open,
  onToggle,
}: {
  profile: CenterProfile;
  onSaved: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const [needs, setNeeds] = useState(profile.needs ?? "");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
    try {
      await saveCenterProfile(sb, { ...profile, needs: needs.trim() || null });
      onSaved();
      onToggle();
    } catch {
      /* el panel se queda abierto con lo escrito: reintentar es un toque */
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="mine-needs">
      <h3 className="dsection">{t("mine.needsNow")}</h3>
      {open ? (
        <>
          <textarea
            className="finput"
            rows={3}
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
            maxLength={400}
            placeholder={t("onb.f.needsHint")}
          />
          <button type="button" className="btnp" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? t("common.saving") : t("common.save")}
          </button>
        </>
      ) : (
        <>
          <p className="mine-needsval">{profile.needs || t("mine.noNeeds")}</p>
          <ToggleButton label={t("common.edit")} on={false} onClick={onToggle} />
        </>
      )}
    </section>
  );
}

function CampaignForm({ locationId, onSaved }: { locationId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<CampaignDraft>({
    location_id: locationId,
    title: "",
    purpose: "",
    goal_amount: 0,
    goal_unit: "",
    raised_amount: 0,
    ends_on: null,
    // Nace ACTIVA: quien acaba de escribir una meta quiere que se vea. Un borrador por
    // defecto es una campaña que nadie publica nunca porque nadie sabe que hay que hacerlo.
    status: "active",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = d.title.trim().length >= 3 && d.purpose.trim().length >= 10 && d.goal_amount > 0
    && d.goal_unit.trim().length > 0;

  async function guardar() {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
    setError(null);
    try {
      await saveCampaign(sb, d);
      onSaved();
    } catch {
      setError(t("error.generic"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="stack mine-form">
      <Field label={t("mine.f.title")} hint={t("mine.f.titleHint")}>
        <input className="finput" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={80} />
      </Field>
      <Field label={t("mine.f.purpose")}>
        <textarea className="finput" rows={3} value={d.purpose} onChange={(e) => setD({ ...d, purpose: e.target.value })} maxLength={600} />
      </Field>
      <div className="mine-two">
        <Field label={t("mine.f.goal")}>
          <input
            className="finput"
            inputMode="decimal"
            value={d.goal_amount || ""}
            onChange={(e) => setD({ ...d, goal_amount: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label={t("mine.f.unit")} hint={t("mine.f.unitHint")}>
          <input className="finput" value={d.goal_unit} onChange={(e) => setD({ ...d, goal_unit: e.target.value })} maxLength={24} />
        </Field>
      </div>
      <Field label={t("mine.f.until")}>
        <input className="finput" type="date" value={d.ends_on ?? ""} onChange={(e) => setD({ ...d, ends_on: e.target.value || null })} />
      </Field>
      {error ? <p className="onb-err" role="status">{error}</p> : null}
      <button type="button" className="btnp" onClick={() => void guardar()} disabled={!listo || guardando}>
        {guardando ? t("common.saving") : t("mine.publish")}
      </button>
    </div>
  );
}

function ActivityForm({ locationId, onSaved }: { locationId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [vol, setVol] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = title.trim().length >= 3 && when !== "";

  async function guardar() {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
    setError(null);
    try {
      await saveActivity(sb, {
        location_id: locationId,
        title: title.trim(),
        description: description.trim() || null,
        // `datetime-local` da hora local sin zona. `new Date()` la interpreta en la del
        // navegador, que es la de quien la escribe, y `toISOString()` la manda en UTC.
        starts_at: new Date(when).toISOString(),
        place: place.trim() || null,
        needs_volunteers: vol,
        status: "scheduled",
      });
      onSaved();
    } catch {
      setError(t("error.generic"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="stack mine-form">
      <Field label={t("mine.f.actTitle")}>
        <input className="finput" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
      </Field>
      <Field label={t("mine.f.when")}>
        <input className="finput" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </Field>
      <Field label={t("mine.f.place")} hint={t("mine.f.placeHint")}>
        <input className="finput" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={160} />
      </Field>
      <Field label={t("mine.f.actDesc")}>
        <textarea className="finput" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
      </Field>
      <label className="mine-check">
        <input type="checkbox" checked={vol} onChange={(e) => setVol(e.target.checked)} />
        {t("activity.needsVolunteers")}
      </label>
      {error ? <p className="onb-err" role="status">{error}</p> : null}
      <button type="button" className="btnp" onClick={() => void guardar()} disabled={!listo || guardando}>
        {guardando ? t("common.saving") : t("mine.publish")}
      </button>
    </div>
  );
}

function PostForm({
  locationId,
  campaigns,
  onSaved,
}: {
  locationId: string;
  campaigns: InitiativeProfile["campaigns"];
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"avance" | "entrega" | "necesidad">("avance");
  const [campaignId, setCampaignId] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
    setError(null);
    try {
      await createPost(sb, {
        location_id: locationId,
        campaign_id: campaignId || null,
        kind,
        body: body.trim(),
        photo_url: null,
      });
      onSaved();
    } catch {
      setError(t("error.generic"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="stack mine-form">
      <Field label={t("mine.f.postKind")}>
        <select className="fselect" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="avance">{t("post.kind.avance")}</option>
          <option value="entrega">{t("post.kind.entrega")}</option>
          <option value="necesidad">{t("post.kind.necesidad")}</option>
        </select>
      </Field>
      {campaigns.length > 0 ? (
        <Field label={t("mine.f.postCampaign")} hint={t("mine.f.postCampaignHint")}>
          <select className="fselect" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">{t("mine.f.noCampaign")}</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label={t("mine.f.postBody")}>
        <textarea className="finput" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1200} />
      </Field>
      {error ? <p className="onb-err" role="status">{error}</p> : null}
      <button
        type="button"
        className="btnp"
        onClick={() => void guardar()}
        disabled={body.trim().length < 3 || guardando}
      >
        {guardando ? t("common.saving") : t("mine.publish")}
      </button>
    </div>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────────────

/**
 * Una fila de formulario. Reusa `.fld` / `.flabel` / `.fhint` / `.finput` del sistema que
 * ya usan el formulario de voluntariado y el panel del equipo: un segundo juego de clases
 * para lo mismo se separa del primero en el primer retoque, y entonces media aplicación
 * tiene los campos de una forma y la otra media de otra.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="fld">
      <span className="flabel">{label}</span>
      {hint ? <span className="fhint">{hint}</span> : null}
      {children}
    </label>
  );
}

function ToggleButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`mine-add${on ? " mine-add-on" : ""}`} onClick={onClick}>
      {on ? <Icon.minus /> : <Icon.plus />}
      {label}
    </button>
  );
}
