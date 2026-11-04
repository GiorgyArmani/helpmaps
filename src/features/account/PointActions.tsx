"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { Button, Field, Notice, TextArea } from "@/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { createPointReport, toggleFavourite } from "@/data/account";
import { fetchFollowersCount, followsAvailable, setFollow } from "@/data/follows";
import { REPORT_KINDS, type ReportKind } from "@/domain/account";
import { useAccount } from "@/features/account/useAccount";
import { useMyLocation } from "@/features/nearby/useMyLocation";

/**
 * Lo que una persona con cuenta puede hacer sobre un punto concreto: guardarlo, y avisar
 * de que algo cambió.
 *
 * ── EL AVISO NO CAMBIA EL MAPA ──────────────────────────────────────────────
 *
 * El texto del formulario lo dice sin rodeos —"lo revisa el equipo antes de cambiar
 * nada"— y no es una cortesía: es la promesa que sostiene todo el diseño. Si esto
 * escribiera directo sobre `center_info.last_confirmed_at`, cualquiera con un correo
 * podría marcar como abierto un refugio cerrado, y encima con el sello de recién
 * confirmado, que es justo lo que hace que la gente le crea. El porqué largo está en
 * `db/01_esquema.sql § 010_accounts` § 4.
 *
 * Prometer menos de lo que se hace es aburrido. Prometer más es lo que manda a una familia
 * a una puerta que no existe.
 *
 * ── SIN CUENTA NO SE ESCONDE, SE EXPLICA ────────────────────────────────────
 *
 * A quien no ha entrado no se le ocultan los botones: se le dice qué son y dónde se
 * consigue una cuenta. Un control que aparece y desaparece según un estado invisible es
 * cómo se pierde la mitad de la gente que habría ayudado.
 */
export default function PointActions({
  locationId,
  followable = false,
  followOnly = false,
}: {
  locationId: string;
  /**
   * Sólo «Seguir». Para el perfil de HelpMaps: no es un lugar al que ir, así que guardar,
   * avisar de un cambio y «estoy aquí» no tienen sentido ahí.
   */
  followOnly?: boolean;
  /**
   * ¿Este punto publica? Seguir sólo tiene sentido con alguien que publique: un acopio
   * importado sin gestor no va a contar nada, y «Seguir» ahí sería una promesa vacía.
   */
  followable?: boolean;
}) {
  const { t } = useI18n();
  const account = useAccount(true);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"sent" | "duplicate" | "error" | null>(null);
  // El check-in: reusa la misma posición que ya pudo pedir «Cerca» o el botón del mapa,
  // así que estando en la pestaña de proximidad esto no vuelve a preguntar nada.
  const here = useMyLocation();
  const [checkin, setCheckin] = useState<"idle" | "sending" | "done" | "far" | "error">("idle");
  const [farKm, setFarKm] = useState<number | null>(null);
  // Qué se acaba de activar, para explicarlo una vez y en ese momento — no en cada visita.
  const [justOn, setJustOn] = useState<"follow" | "save" | null>(null);

  const saved = account.favourites.has(locationId);
  const following = account.follows.has(locationId);
  const [followBusy, setFollowBusy] = useState(false);
  // Cuántos la siguen: prueba social, y lo que invita a sumarse. Público, sin nombres.
  const [followers, setFollowers] = useState<number | null>(null);

  useEffect(() => {
    if (!followable) return;
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void fetchFollowersCount(sb, locationId).then((n) => {
      if (vivo) setFollowers(n);
    });
    return () => {
      vivo = false;
    };
  }, [followable, locationId]);

  const onToggleFollow = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || followBusy) return;
    setFollowBusy(true);
    const next = !following;
    setJustOn(next ? "follow" : null);
    // Optimista, como guardar: el botón responde ya y se revierte si falla.
    account.setFollowing(locationId, next);
    setFollowers((n) => (n === null ? n : Math.max(0, n + (next ? 1 : -1))));
    try {
      await setFollow(sb, locationId, next);
    } catch {
      account.setFollowing(locationId, !next);
      setFollowers((n) => (n === null ? n : Math.max(0, n + (next ? -1 : 1))));
    } finally {
      setFollowBusy(false);
    }
  }, [account, followBusy, following, locationId]);

  const showFollow = followable && followsAvailable();

  const onToggleSave = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || busy) return;
    setBusy(true);
    setJustOn(saved ? null : "save");
    // Optimista: el corazón responde ya. En una barra de señal, esperar la ida y vuelta
    // se siente como que el botón no funciona y la gente lo toca tres veces.
    account.setFavourite(locationId, !saved);
    try {
      await toggleFavourite(sb, locationId, !saved);
    } catch {
      account.setFavourite(locationId, saved); // revertir
    } finally {
      setBusy(false);
    }
  }, [account, busy, locationId, saved]);

  const send = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !kind || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await createPointReport(sb, { locationId, kind, note });
      setResult(r.duplicate ? "duplicate" : "sent");
      if (r.ok) {
        setKind(null);
        setNote("");
        // AQUÍ NO SE SUMA EXPERIENCIA, y es a propósito.
        //
        // La primera versión de esto la sumaba al enviar, y así cualquiera pulsaba «sigue
        // abierto» en cincuenta puntos en una tarde y subía de nivel sin comprobar nada.
        // Ahora la otorga un trigger cuando el EQUIPO aplica el aviso — misma lógica que
        // ya rige el aviso en sí: es una señal, y sólo cuenta cuando alguien la confirma.
        // Ver `db/06_reconocimiento.sql` § 6.
      }
    } catch {
      setResult("error");
    } finally {
      setBusy(false);
    }
  }, [busy, kind, locationId, note]);

  /**
   * «Estoy aquí».
   *
   * La posición se manda al servidor, que comprueba la distancia y la DESCARTA — no se
   * guarda en ningún sitio. Ver `app/api/checkin/route.ts`, donde está el porqué largo.
   *
   * Se pide aquí y no se asume: `useMyLocation` sólo devuelve algo si esta persona ya dio
   * permiso en esta pestaña, y un botón que dispara el diálogo del navegador sin avisar
   * es cómo se consigue que alguien lo bloquee para siempre.
   */
  const doCheckin = useCallback(async () => {
    if (checkin === "sending") return;
    setCheckin("sending");
    // Un solo toque: si no hay posición se pide aquí y se sigue en cuanto llega. Antes
    // hacían falta dos —uno para el permiso y otro para volver a pulsar— y eso es fricción
    // justo en la acción que este producto más quiere provocar.
    const fix = here.fix ?? (await here.ensure());
    if (!fix) {
      setCheckin("idle");
      return;
    }
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locationId, lat: fix.lat, lng: fix.lng }),
      });
      const data: { error?: string; km?: number } = await res.json().catch(() => ({}));
      if (res.ok) {
        setCheckin("done");
      } else if (data.error === "too_far") {
        setFarKm(data.km ?? null);
        setCheckin("far");
      } else {
        setCheckin("error");
      }
    } catch {
      setCheckin("error");
    }
  }, [checkin, here, locationId]);

  if (!account.checked) return null;

  function followersLabel(n: number) {
    return n === 1 ? t("follow.countSingle") : t("follow.count", { n });
  }

  const hint =
    justOn === "follow" && following
      ? t("follow.followingHint")
      : justOn === "save" && saved
        ? t("point.saveHint")
        : null;
  const count =
    showFollow && followers !== null
      ? followers > 0
        ? followersLabel(followers)
        : following
          ? null
          : t("follow.first")
      : null;
  const footNote = [count, hint].filter(Boolean).join(" · ");

  if (!account.userId) {
    return (
      <p className="small mut">
        {followable && followers ? `${followersLabel(followers)} · ` : ""}
        {followable ? t("follow.needAccount") : t("point.needAccount")}{" "}
        <Link className="linkish" href="/registro">
          {t("login.createAccount")}
        </Link>
      </p>
    );
  }

  return (
    <div>
      <div className="dactions">
        {showFollow ? (
          <button
            type="button"
            className={following ? "btng act-follow act-follow-on" : "btnp act-follow"}
            onClick={() => void onToggleFollow()}
            disabled={followBusy}
            aria-pressed={following}
          >
            {following ? <Icon.check /> : <Icon.follow />}
            {following ? t("follow.following") : t("follow.follow")}
          </button>
        ) : null}

        {followOnly ? null : (
          <>
        <button
          type="button"
          className={saved ? "btnp act-save" : "btng act-save"}
          onClick={onToggleSave}
          disabled={busy}
          aria-pressed={saved}
        >
          <Icon.heart />
          {saved ? t("point.saved") : t("point.save")}
        </button>

        <button type="button" className="btng act-report" onClick={() => setOpen((v) => !v)}>
          <Icon.alert />
          {t("point.report")}
        </button>

        {/* «Estoy aquí». Es la acción que más experiencia da, y la única que exige haber
            salido de casa — de ahí que sea la que este producto quiere provocar. */}
        <button
          type="button"
          className={checkin === "done" ? "btnp act-here" : "btng act-here"}
          onClick={() => void doCheckin()}
          disabled={checkin === "sending" || checkin === "done"}
        >
          <Icon.target />
          {checkin === "done"
            ? t("point.checkedIn")
            : checkin === "sending" || here.status === "locating"
              ? t("nearby.locating")
              : t("point.checkin")}
        </button>
          </>
        )}
      </div>

      {/* Una sola nota bajo los botones: los seguidores y, justo después de seguir o
          guardar, qué significa. Nada fijo que se repita en cada visita. */}
      {footNote ? <p className="small mut">{footNote}</p> : null}
      {checkin === "far" ? (
        <p className="lerr">
          {farKm !== null ? t("point.tooFarKm", { km: farKm }) : t("point.tooFar")}
        </p>
      ) : null}
      {checkin === "error" ? <p className="lerr">{t("error.generic")}</p> : null}
      {here.status === "denied" && !followOnly ? <p className="small mut">{t("nearby.denied")}</p> : null}
      {checkin === "done" ? <p className="small mut">{t("point.checkedInHint")}</p> : null}

      {open ? (
        <div className="form">
          <p className="small mut" style={{ margin: 0 }}>
            {t("point.reportIntro")}
          </p>

          <div className="chips">
            {REPORT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={kind === k ? "chip chip-on" : "chip"}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
              >
                {t(`point.report.${k}`)}
              </button>
            ))}
          </div>

          <Field label={t("point.reportNote")}>
            <TextArea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <Button type="button" onClick={send} loading={busy} disabled={!kind || busy} block>
            {t("point.reportSend")}
          </Button>

          {result === "sent" ? <Notice tone="info">{t("point.reportThanks")}</Notice> : null}
          {result === "duplicate" ? <Notice tone="info">{t("point.reportDuplicate")}</Notice> : null}
          {result === "error" ? <Notice tone="danger">{t("admin.saveError")}</Notice> : null}
        </div>
      ) : null}
    </div>
  );
}
