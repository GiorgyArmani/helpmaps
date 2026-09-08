"use client";

import { useEffect, useState } from "react";
import type { InitiativeProfile, CampaignDraft } from "@/data/initiatives";
import { createPost, saveActivity, saveCampaign, uploadPostImage } from "@/data/initiatives";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Los formularios del panel de una iniciativa, y las dos piezas que comparten.
 *
 * Salieron de `InitiativePanel.tsx` cuando ese archivo pasó de 700 líneas: el contenedor,
 * el onboarding, la gestión diaria y cuatro formularios en el mismo sitio ya no cabían en
 * la cabeza de nadie, y cada retoque obligaba a releerlo entero para saber qué se tocaba.
 */

export function CampaignForm({ locationId, onSaved }: { locationId: string; onSaved: () => void }) {
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

export function ActivityForm({ locationId, onSaved }: { locationId: string; onSaved: () => void }) {
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

export function PostForm({
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

  // La foto.
  //
  // La vista previa sale del archivo local (`URL.createObjectURL`) y aparece AL INSTANTE,
  // mientras la subida va por detrás. Enseñarla sólo cuando el servidor contesta deja unos
  // segundos en los que no ha pasado nada visible, y en una barra y media de cobertura eso
  // se lee como que el botón no funcionó y se vuelve a tocar.
  //
  // Y se sube al ELEGIRLA, no al publicar: así el envío espera mientras se escribe el
  // texto, que es tiempo que la persona iba a gastar de todos modos. El precio es que
  // abandonar el formulario deja un archivo huérfano en el bucket; son unos kilobytes y es
  // preferible a que «Publicar» se quede pensando medio minuto con una foto de 3 MB.
  const [previa, setPrevia] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    // Liberar el objeto local al cambiar de foto o al cerrar: si no, el navegador retiene
    // el archivo entero en memoria mientras la pestaña siga abierta.
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  async function elegirFoto(file: File | null) {
    const sb = getSupabase();
    if (!sb || !file) return;
    setPrevia(URL.createObjectURL(file));
    setFotoUrl(null);
    setSubiendo(true);
    setError(null);
    try {
      setFotoUrl(await uploadPostImage(sb, locationId, file));
    } catch {
      setError(t("mine.imageFail"));
      setPrevia(null);
    } finally {
      setSubiendo(false);
    }
  }

  function quitarFoto() {
    setPrevia(null);
    setFotoUrl(null);
  }

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
        photo_url: fotoUrl,
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

      <Field label={t("mine.f.postPhoto")} hint={t("mine.f.postPhotoHint")}>
        <label className="mine-drop mine-drop-wide">
          {previa ? (
            // eslint-disable-next-line @next/next/no-img-element -- archivo local y bucket por país
            <img src={previa} alt="" />
          ) : (
            <span className="mine-drop-empty">
              <Icon.plus />
              {subiendo ? t("common.saving") : t("mine.imagePick")}
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={subiendo}
            onChange={(e) => {
              void elegirFoto(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
        {previa ? (
          <button type="button" className="mine-camp-btn" onClick={quitarFoto}>
            {t("mine.imageClear")}
          </button>
        ) : null}
      </Field>

      {error ? <p className="onb-err" role="status">{error}</p> : null}
      <button
        type="button"
        className="btnp"
        onClick={() => void guardar()}
        disabled={body.trim().length < 3 || guardando || subiendo}
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
export function Field({
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

export function ToggleButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`mine-add${on ? " mine-add-on" : ""}`} onClick={onClick}>
      {on ? <Icon.minus /> : <Icon.plus />}
      {label}
    </button>
  );
}
