"use client";

import { useState } from "react";
import type { Center } from "@/domain/types";
import type { DonationClaim } from "@/data/initiatives";
import { confirmAttendance, type AttendanceToConfirm } from "@/data/events";
import { getSupabase } from "@/lib/supabase/client";
import { skillLabel } from "@/features/volunteer/EventNeeds";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

/**
 * La configuración de la organización: lo que no es contenido del perfil.
 *
 * El perfil es lo que se enseña; esto es con lo que se trabaja. Separarlo es lo que deja
 * que la página se lea como una página y no como un panel de control: los aportes por
 * confirmar, el QR y el enlace son herramientas del gestor, y el público nunca las ve.
 */
export default function OrgSettings({
  center,
  claims,
  onResolve,
  attendance,
  onAttendanceConfirmed,
  onBack,
}: {
  center: Center;
  claims: DonationClaim[];
  onResolve: (id: string, status: "confirmed" | "rejected") => void;
  /** Eventos que ya pasaron con gente apuntada por confirmar. */
  attendance: AttendanceToConfirm[];
  onAttendanceConfirmed: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  // El aviso de «listo» vive aquí y no en la tarjeta: al confirmar a todos, la tarjeta se va
  // con la recarga, y el aviso tiene que quedarse para que se sepa que se guardó.
  const [confirmadas, setConfirmadas] = useState<number | null>(null);

  return (
    <div className="pedit">
      <div className="pedit-bar">
        <button type="button" className="pedit-back" onClick={onBack} aria-label={t("org.back")}>
          <Icon.back />
        </button>
        <h2 className="pedit-bar-title">{t("org.title")}</h2>
      </div>

      <p className="pedit-bar-sub">{center.name}</p>

      {/* Primero lo que tiene a alguien esperando.
          Sólo si hay algo: «Ya aporté» está apagado en la ficha (ver `DonateBox`), así que
          no llegan aportes nuevos y una sección siempre vacía se leería como una tarea
          pendiente. Los que quedaron declarados de antes siguen apareciendo aquí. */}
      {claims.length > 0 ? (
        <section className="ecard">
          <div className="ecard-head">
            <h3 className="ecard-title">{t("org.claimsTitle")}</h3>
            <span className="pedit-count">{claims.length}</span>
          </div>
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
      ) : null}

      {/* Quién vino a cada evento. Va con los aportes, arriba, por la misma razón: al otro
          lado hay alguien que ayudó y espera que conste. */}
      {confirmadas !== null ? (
        <p className="att-done" role="status">
          <Icon.check />
          {confirmadas === 1 ? t("att.doneOne") : t("att.done", { n: confirmadas })}
        </p>
      ) : null}
      {attendance.map((a) => (
        <AttendanceCard
          key={a.activityId}
          event={a}
          onConfirmed={(n) => {
            setConfirmadas(n);
            onAttendanceConfirmed();
          }}
        />
      ))}

      {/* El QR de reconocimiento. Todavía sin código detrás, y por eso sin QR: enseñar uno
          que no suma nada sería prometerle a un voluntario algo que no va a pasar. */}
      <section className="ecard">
        <div className="ecard-head">
          <h3 className="ecard-title">
            <Icon.qr />
            {t("org.qrTitle")}
          </h3>
          <span className="org-soon">{t("org.soon")}</span>
        </div>
        <p className="ecard-text">{t("org.qrBody")}</p>
      </section>

      <ShareCard center={center} />
    </div>
  );
}

/**
 * «¿Quién vino?» para un evento: la lista de apuntados, se marca a quien vino y se confirma
 * de una vez.
 *
 * Casillas y un solo botón, y no un «Vino» por fila: después de una jornada de treinta
 * personas, treinta confirmaciones sueltas son treinta viajes con mala señal y treinta
 * ocasiones de tocar la fila de al lado. Aquí se repasa la lista y se envía una vez.
 *
 * Empieza SIN marcar a nadie, a propósito. Con todos marcados de entrada, lo cómodo es
 * pulsar confirmar sin mirar, y la experiencia sólo vale si alguien comprobó que la persona
 * estaba. «Marcar a todos» existe para el caso honesto en el que vinieron todos.
 */
function AttendanceCard({
  event,
  onConfirmed,
}: {
  event: AttendanceToConfirm;
  onConfirmed: (n: number) => void;
}) {
  const { t, lang } = useI18n();
  const [marked, setMarked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [fallo, setFallo] = useState(false);

  const todos = event.people.length > 0 && marked.size === event.people.length;

  function toggle(id: string) {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmar() {
    const sb = getSupabase();
    if (!sb || marked.size === 0 || busy) return;
    setBusy(true);
    setFallo(false);
    try {
      const n = await confirmAttendance(sb, event.activityId, [...marked]);
      setMarked(new Set());
      onConfirmed(n);
    } catch {
      // Se dice, y la selección se queda: reintentar es un toque, no volver a marcar a todos.
      setFallo(true);
    } finally {
      setBusy(false);
    }
  }

  const fecha = new Date(event.startsAt).toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });

  return (
    <section className="ecard att">
      <div className="ecard-head">
        <h3 className="ecard-title">
          <Icon.users />
          {t("att.title")}
        </h3>
        <span className="pedit-count">{event.people.length}</span>
      </div>
      <p className="att-event">
        <b>{event.title}</b>
        <span>{fecha}</span>
      </p>
      <p className="fhint">{t("att.hint")}</p>

      <div className="att-people">
        {event.people.map((p) => (
          <label key={p.userId} className={`att-person${marked.has(p.userId) ? " att-person-on" : ""}`}>
            <input type="checkbox" checked={marked.has(p.userId)} onChange={() => toggle(p.userId)} />
            <span className="att-who">
              <b>{p.name || t("account.noName")}</b>
              {p.skills.length > 0 ? (
                <span className="att-skills">{p.skills.map((sk) => t(skillLabel(sk))).join(" · ")}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      <div className="att-acts">
        <button
          type="button"
          className="btng"
          onClick={() => setMarked(todos ? new Set() : new Set(event.people.map((p) => p.userId)))}
        >
          {todos ? t("att.none") : t("att.all")}
        </button>
        <button type="button" className="btnp" disabled={marked.size === 0 || busy} onClick={() => void confirmar()}>
          <Icon.check />
          {busy
            ? t("common.saving")
            : marked.size === 1
              ? t("att.confirmOne")
              : t("att.confirm", { n: marked.size })}
        </button>
      </div>
      {fallo ? (
        <p className="lerr" role="alert">
          {t("error.generic")}
        </p>
      ) : null}
    </section>
  );
}

function ShareCard({ center }: { center: Center }) {
  const { t } = useI18n();
  const [copiado, setCopiado] = useState(false);
  const url = typeof window === "undefined" ? `/c/${center.id}` : `${window.location.origin}/c/${center.id}`;
  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles el enlace sigue a la vista y se puede seleccionar.
    }
  }

  return (
    <section className="ecard">
      <div className="ecard-head">
        <h3 className="ecard-title">{t("org.linkTitle")}</h3>
      </div>
      <p className="ecard-text">{t("org.linkBody")}</p>
      <p className="org-url">{url.replace(/^https?:\/\//, "")}</p>
      <div className="ecard-acts">
        <button type="button" className="btng" onClick={() => void copiar()}>
          <Icon.link />
          {copiado ? t("common.copied") : t("org.copyLink")}
        </button>
        {puedeCompartir ? (
          <button
            type="button"
            className="btng"
            onClick={() => void navigator.share({ title: center.name, url }).catch(() => {})}
          >
            <Icon.share />
            {t("org.share")}
          </button>
        ) : (
          <a className="btng" href={`/c/${center.id}`} target="_blank" rel="noopener noreferrer">
            <Icon.eye />
            {t("org.openPublic")}
          </a>
        )}
      </div>
    </section>
  );
}
