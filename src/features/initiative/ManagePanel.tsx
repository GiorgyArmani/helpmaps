"use client";

import { useCallback, useEffect, useState } from "react";
import type { Center, CenterStatus } from "@/domain/types";
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
import { Icon } from "@/ui/icons";
import { useI18n, useTimeAgo } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";
import SupplyQuickAdd from "@/features/centers/SupplyQuickAdd";
import SupplyPicker from "@/features/centers/SupplyPicker";
import { ActivityForm, CampaignForm, Field, PostForm, ToggleButton } from "./forms";

/**
 * El panel diario de quien dirige un punto.
 *
 * ── EL ORDEN NO ES ARBITRARIO ───────────────────────────────────────────────
 *
 * Esto lo usa alguien de pie en un comedor, con el teléfono en una mano. Lo que se ordena
 * primero es lo que cambia todos los días y lo que a otra persona le sirve HOY:
 *
 *   1. Los aportes que esperan respuesta. Es lo único donde hay alguien esperando, y de
 *      esa respuesta depende que se le reconozca lo que dio.
 *   2. Si están abiertos. Un toque. Es el dato que evita que alguien cruce la ciudad para
 *      encontrarse una puerta cerrada, y el que más rápido se queda viejo.
 *   3. Qué hace falta hoy.
 *
 * Lo demás —campañas, agenda, novedades— es trabajo de fondo. Y el perfil va al final y
 * PLEGADO: se rellena una vez en el onboarding y se toca cada varios meses; tenerlo
 * abierto empujaba lo diario fuera de la pantalla.
 *
 * ── LO QUE FALTABA Y AHORA ESTÁ ─────────────────────────────────────────────
 *
 * La primera versión sólo dejaba escribir «qué hace falta». Faltaban dos cosas que un
 * gestor necesita de verdad: decir que están LLENOS o CERRADOS —hasta ahora sólo podía
 * hacerlo el equipo, así que un comedor que se llenaba seguía saliendo como abierto— y
 * corregir su propio perfil, que sólo se podía rellenar durante el onboarding y quedaba
 * congelado para siempre.
 */
export default function ManagePanel({
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
  const [abierto, setAbierto] = useState<
    "needs" | "campaign" | "activity" | "post" | "profile" | null
  >(null);

  const [claims, setClaims] = useState<DonationClaim[]>([]);
  const [vueltaClaims, setVueltaClaims] = useState(0);
  const recargarClaims = useCallback(() => setVueltaClaims((v) => v + 1), []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void fetchClaimsForLocation(sb, center.id).then((c) => {
      if (vivo) setClaims(c);
    });
    return () => {
      vivo = false;
    };
  }, [center.id, vueltaClaims]);

  const pendientes = claims.filter((c) => c.status === "pending");

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

  return (
    <>
      {pendientes.length > 0 ? (
        <ClaimsBox claims={pendientes} onResolve={resolver} />
      ) : null}

      <StatusBox profile={profile} onSaved={onSaved} />

      <NeedsBox
        profile={profile}
        onSaved={onSaved}
        open={abierto === "needs"}
        onToggle={() => setAbierto((a) => (a === "needs" ? null : "needs"))}
      />

      <h3 className="dsection">{t("mine.campaigns")}</h3>
      {content.campaigns.length === 0 ? (
        <p className="mine-none">{t("mine.noCampaigns")}</p>
      ) : (
        content.campaigns.map((c) => (
          <CampaignRow key={c.id} campaign={c} onSaved={onSaved} />
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
      {/* Lo ya publicado se VE. Sin esto, quien escribía dos veces lo mismo no tenía forma
          de saberlo, y el panel no daba ninguna señal de que la publicación llegó. */}
      {content.posts.length === 0 ? (
        <p className="mine-none">{t("mine.noPosts")}</p>
      ) : (
        content.posts.slice(0, 5).map((p) => <PostRow key={p.id} body={p.body} at={p.created_at} />)
      )}
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

      <h3 className="dsection">{t("mine.images")}</h3>
      <ImagesBox center={center} content={content} onSaved={onSaved} />

      <h3 className="dsection">{t("mine.profile")}</h3>
      <ToggleButton
        label={abierto === "profile" ? t("common.close") : t("mine.editProfile")}
        on={abierto === "profile"}
        onClick={() => setAbierto((a) => (a === "profile" ? null : "profile"))}
      />
      {abierto === "profile" ? (
        <ProfileForm
          profile={profile}
          onSaved={() => {
            setAbierto(null);
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}

// ── Aportes por confirmar ──────────────────────────────────────────────────

function ClaimsBox({
  claims,
  onResolve,
}: {
  claims: DonationClaim[];
  onResolve: (id: string, status: "confirmed" | "rejected") => void;
}) {
  const { t } = useI18n();
  return (
    <section className="claims">
      <h3 className="dsection">{t("claims.title")}</h3>
      <p className="fhint">{t("claims.hint")}</p>
      {claims.map((c) => (
        <article key={c.id} className="claim">
          <span className="claim-who">
            <b>{c.donor_name ?? t("account.noName")}</b>
            {c.note ? <span className="claim-note">{c.note}</span> : null}
          </span>
          <span className="claim-acts">
            <button type="button" className="claim-yes" onClick={() => onResolve(c.id, "confirmed")}>
              {t("claims.confirm")}
            </button>
            <button type="button" className="claim-no" onClick={() => onResolve(c.id, "rejected")}>
              {t("claims.reject")}
            </button>
          </span>
        </article>
      ))}
    </section>
  );
}

// ── ¿Están abiertos? ───────────────────────────────────────────────────────

const ESTADOS: { value: CenterStatus; label: string }[] = [
  { value: "abierto", label: "status.abierto" },
  { value: "lleno", label: "status.lleno" },
  { value: "cerrado", label: "status.cerrado" },
];

/**
 * Abierto / lleno / cerrado, a un toque.
 *
 * Es el dato más perecedero de toda la ficha y el que más daño hace cuando está viejo:
 * quien lo lee cruza una ciudad. Hasta ahora sólo podía cambiarlo el equipo, así que un
 * comedor que se llenaba a las once seguía saliendo abierto toda la tarde.
 *
 * Sin botón de guardar: tocar el estado ES guardarlo. Un formulario de tres opciones con
 * su botón de confirmar añade un paso a la acción que más veces al día se repite.
 */
function StatusBox({ profile, onSaved }: { profile: CenterProfile; onSaved: () => void }) {
  const { t } = useI18n();
  const [guardando, setGuardando] = useState<CenterStatus | null>(null);
  // Que el fallo SE VEA. El `catch` vacío que había aquí dejaba el botón como estaba y no
  // decía nada: quien está de pie en la puerta tocando «Lleno» no puede distinguir «no se
  // guardó» de «no llegué a tocarlo», y este es justo el dato por el que alguien cruza la
  // ciudad. Sin señal, el gestor se va creyendo que lo avisó.
  const [fallo, setFallo] = useState(false);
  const actual = profile.status;

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
    <section className="mine-status">
      <h3 className="dsection">{t("mine.statusNow")}</h3>
      <div className="mine-status-row">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            type="button"
            className={`mine-st${actual === e.value ? ` mine-st-on mine-st-${e.value}` : ""}`}
            aria-pressed={actual === e.value}
            disabled={guardando !== null}
            onClick={() => void poner(e.value)}
          >
            {t(e.label as "status.abierto")}
          </button>
        ))}
      </div>
      <p className={fallo ? "mine-status-fail" : "fhint"}>
        {fallo ? t("mine.statusFail") : actual ? t("mine.statusHint") : t("mine.statusNone")}
      </p>
    </section>
  );
}

// ── Qué hace falta hoy ─────────────────────────────────────────────────────

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
          <SupplyQuickAdd value={needs} onChange={setNeeds} />
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

// ── Una campaña, con lo que lleva ──────────────────────────────────────────

/**
 * Una campaña en la lista, con su barra y la posibilidad de poner al día lo recaudado.
 *
 * Actualizar esa cifra es la razón por la que un gestor vuelve a esta pantalla: una
 * campaña con la barra congelada en cero durante semanas se lee como abandonada, y quien
 * la mira no vuelve a mirarla.
 *
 * La cifra es DECLARADA, y la ficha pública lo dice. Aquí no hace falta repetirlo: quien
 * la escribe ya sabe que la está declarando él.
 */
function CampaignRow({
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
  const [guardando, setGuardando] = useState(false);

  const pct =
    campaign.goal_amount > 0
      ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100))
      : 0;

  async function guardar(cerrar = false) {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
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
      });
      setAbierto(false);
      onSaved();
    } catch {
      /* se queda abierto con lo escrito */
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mine-camp">
      <p className="mine-row">
        <span className="mine-row-t">{campaign.title}</span>
        <span className="mine-row-m">
          {campaign.raised_amount} / {campaign.goal_amount} {campaign.goal_unit}
        </span>
      </p>
      <div className="icamp-bar">
        <span className="icamp-fill" style={{ width: `${pct}%` }} />
      </div>

      {abierto ? (
        <div className="mine-camp-edit">
          <Field label={t("mine.f.raised")} hint={t("mine.f.raisedHint")}>
            <input
              className="finput"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Field>
          {/* Cerrar pregunta antes, y en el sitio.
              Cerrar una campaña la saca de la lista PARA SIEMPRE: el panel sólo trae las
              `active` y `reached`, así que desde aquí no hay forma de reabrirla. Estaba a
              un toque de distancia de «Guardar», mismo tamaño y pegado a él, que es el
              gesto que más se repite en esta caja. En un teléfono eso es un roce, y el
              roce terminaba una recaudación en marcha.
              La pregunta va en línea y no en un `confirm()` del navegador: un diálogo del
              sistema aquí es un sobresalto, y sobre todo se contesta que sí por reflejo. */}
          {cerrando ? (
            <div className="mine-camp-sure">
              <p className="mine-camp-sure-q">{t("mine.closeSure")}</p>
              <div className="wrapline">
                <button type="button" className="btng" onClick={() => void guardar(true)} disabled={guardando}>
                  {guardando ? t("common.saving") : t("mine.closeYes")}
                </button>
                <button type="button" className="btng" onClick={() => setCerrando(false)} disabled={guardando}>
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="wrapline">
              <button type="button" className="btnp" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? t("common.saving") : t("common.save")}
              </button>
              <button type="button" className="mine-camp-close" onClick={() => setCerrando(true)} disabled={guardando}>
                {t("mine.closeCampaign")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="mine-camp-btn" onClick={() => setAbierto(true)}>
          {t("mine.updateRaised")}
        </button>
      )}
    </div>
  );
}

function PostRow({ body, at }: { body: string; at: string }) {
  const ago = useTimeAgo();
  return (
    <p className="mine-post">
      <span className="mine-post-when">{ago(at)}</span>
      <span className="mine-post-body">{body}</span>
    </p>
  );
}

// ── El perfil, editable después del onboarding ─────────────────────────────

/**
 * Todo lo que el onboarding preguntó una vez, y que hasta ahora quedaba congelado.
 *
 * Un comedor cambia de horario, se muda de responsable, abre una cuenta nueva. Sin esta
 * pantalla la única forma de corregirlo era pedírselo al equipo — que es exactamente la
 * dependencia que el rol de gestor venía a quitar.
 */
function ProfileForm({ profile, onSaved }: { profile: CenterProfile; onSaved: () => void }) {
  const { t } = useI18n();
  const [d, setD] = useState<CenterProfile>(profile);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CenterProfile>(k: K, v: CenterProfile[K]) =>
    setD((x) => ({ ...x, [k]: v }));

  async function guardar() {
    const sb = getSupabase();
    if (!sb) return;
    setGuardando(true);
    setError(null);
    try {
      await saveCenterProfile(sb, d);
      onSaved();
    } catch {
      setError(t("error.generic"));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="stack mine-form">
      <Field label={t("onb.f.category")} hint={t("onb.f.categoryHint")}>
        <input
          className="finput"
          value={d.category ?? ""}
          onChange={(e) => set("category", e.target.value || null)}
          maxLength={60}
        />
      </Field>
      <Field label={t("onb.f.description")} hint={t("onb.f.descriptionHint")}>
        <textarea
          className="finput"
          rows={4}
          value={d.description ?? ""}
          onChange={(e) => set("description", e.target.value || null)}
          maxLength={600}
        />
      </Field>
      <Field label={t("onb.f.schedule")} hint={t("onb.f.scheduleHint")}>
        <input
          className="finput"
          value={d.schedule ?? ""}
          onChange={(e) => set("schedule", e.target.value || null)}
          maxLength={120}
        />
      </Field>
      <Field label={t("onb.f.contact")} hint={t("onb.f.contactHint")}>
        <input
          className="finput"
          value={d.contact_name ?? ""}
          onChange={(e) => set("contact_name", e.target.value || null)}
          maxLength={80}
        />
      </Field>

      {/* Qué recibe: el mismo selector del panel del equipo. Un gestor no debería tener
          una versión distinta del control que rellena el mismo campo. */}
      <Field label={t("form.receives")}>
        <SupplyPicker value={d.receives} onChange={(next) => set("receives", next)} />
      </Field>

      <Field label={t("onb.f.donateInfo")} hint={t("onb.f.donateInfoHint")}>
        <textarea
          className="finput"
          rows={4}
          value={d.donate_info ?? ""}
          onChange={(e) => set("donate_info", e.target.value || null)}
          maxLength={600}
        />
      </Field>
      <Field label={t("onb.f.donateUrl")}>
        <input
          className="finput"
          inputMode="url"
          placeholder="https://"
          value={d.donate_url ?? ""}
          onChange={(e) => set("donate_url", e.target.value || null)}
        />
      </Field>
      <div className="mine-two">
        <Field label={t("center.website")}>
          <input
            className="finput"
            inputMode="url"
            value={d.website ?? ""}
            onChange={(e) => set("website", e.target.value || null)}
          />
        </Field>
        <Field label={t("onb.f.instagram")}>
          <input
            className="finput"
            value={d.instagram ?? ""}
            onChange={(e) => set("instagram", e.target.value.replace(/^@/, "") || null)}
            maxLength={40}
          />
        </Field>
      </div>

      {error ? <p className="onb-err">{error}</p> : null}

      <button type="button" className="btnp" onClick={() => void guardar()} disabled={guardando}>
        {guardando ? t("common.saving") : t("common.save")}
      </button>

      {/* Lo que el gestor NO puede tocar, dicho aquí y no en un error después de
          intentarlo: mover un pin manda gente al lugar equivocado, y ese error no lo
          arregla quien lo comete. */}
      <p className="fhint">
        <Icon.alert /> {t("mine.profileLocked")}
      </p>
    </div>
  );
}

// ── La portada y la foto del perfil ────────────────────────────────────────

/**
 * Las dos imágenes que el perfil público enseña.
 *
 * Es lo primero que ve quien abre `/c/<id>` desde un enlace, y hasta ahora no había forma
 * de ponerlas: todos los perfiles se veían iguales. Para una iniciativa que quiere que la
 * tomen en serio —un aliado, un donante— eso era la diferencia entre tener un sitio propio
 * y tener una entrada en una lista.
 *
 * Sube al tocar, sin botón de guardar aparte: elegir un archivo YA es la confirmación, y
 * un «guardar» detrás es un paso más en el que se pierde gente. Lo que sí hay es cómo
 * quitarla, porque una imagen que no se puede retirar es una que nadie se atreve a poner.
 */
function ImagesBox({
  center,
  content,
  onSaved,
}: {
  center: Center;
  content: InitiativeProfile;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [subiendo, setSubiendo] = useState<"banner" | "photo" | null>(null);
  const [fallo, setFallo] = useState(false);

  async function elegir(kind: "banner" | "photo", file: File | null) {
    const sb = getSupabase();
    if (!sb || !file || subiendo) return;
    setSubiendo(kind);
    setFallo(false);
    try {
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
    <section className="mine-img">
      <ImageSlot
        label={t("mine.banner")}
        hint={t("mine.bannerHint")}
        url={content.images.banner}
        wide
        busy={subiendo === "banner"}
        onPick={(f) => void elegir("banner", f)}
        onClear={() => void quitar("banner")}
      />
      <ImageSlot
        label={t("mine.photo")}
        hint={t("mine.photoHint")}
        url={content.images.photo}
        busy={subiendo === "photo"}
        onPick={(f) => void elegir("photo", f)}
        onClear={() => void quitar("photo")}
      />
      {fallo ? <p className="mine-status-fail">{t("mine.imageFail")}</p> : null}
    </section>
  );
}

function ImageSlot({
  label,
  hint,
  url,
  wide,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  url: string | null;
  wide?: boolean;
  busy: boolean;
  onPick: (file: File | null) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mine-slot">
      <span className="flab">{label}</span>
      <p className="fhint">{hint}</p>
      {/* La etiqueta ES el botón: envuelve un `input` de archivo escondido. Un `input`
          de archivo con su aspecto de fábrica no se puede estilar y sale distinto en cada
          navegador, que es justo lo que hace que una pantalla parezca sin terminar. */}
      <label className={`mine-drop${wide ? " mine-drop-wide" : ""}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- bucket por país
          <img src={url} alt="" />
        ) : (
          <span className="mine-drop-empty">
            <Icon.plus />
            {busy ? t("common.saving") : t("mine.imagePick")}
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            // Se vacía para que volver a elegir EL MISMO archivo dispare el cambio: si no,
            // reintentar tras un fallo de red no hacía nada y parecía que el botón murió.
            e.target.value = "";
          }}
        />
      </label>
      {url ? (
        <button type="button" className="mine-camp-btn" onClick={onClear}>
          {t("mine.imageClear")}
        </button>
      ) : null}
    </div>
  );
}
