"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACTION_POINTS,
  BADGES,
  countContributions,
  levelFor,
  type ContributionKind,
  type Counts,
} from "@/domain/badges";
import { fetchMyBadges, fetchMyContributions, setLeaderboardOptIn } from "@/data/recognition";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Lo que alguien ha aportado: su nivel, su experiencia y sus medallas.
 *
 * ── DOS PIEZAS, UNA SOLA CONSULTA ───────────────────────────────────────────
 *
 * El nivel va arriba de «Mi cuenta», en la tarjeta de la persona junto a su avatar: es lo
 * que enseña y lo que un comercio aliado mirará para dar su beneficio. El detalle —cómo se
 * sube, las medallas, aparecer en la tabla— es una sección propia («Logros»), que se abre
 * desde el menú de la cuenta. Las dos leen lo mismo, así que lo pide `useRecognition` una
 * vez y lo comparten.
 *
 * ── LAS MEDALLAS SE CALCULAN ALLÍ Y SE LEEN AQUÍ ─────────────────────────────
 *
 * Las otorga un trigger sobre `contributions` en el momento en que pueden cambiar, así que
 * cuando esta pantalla las lee ya están puestas. Antes se calculaban aquí y se pedían con
 * `award_badge`, y eso dejaba pedirse cualquiera desde la consola del navegador. La MONEDA
 * —los puntos— no se puede escribir desde el cliente en absoluto.
 *
 * ── APARECER EN LA LISTA ES OPT-IN, Y SE DICE QUÉ SE PUBLICA ────────────────
 *
 * El interruptor explica que se vería el nombre y el total, y que NO se publica dónde
 * estuvo nadie. Es la primera pregunta que se hace cualquiera antes de marcarlo, y en
 * este país no es una pregunta ociosa.
 */
export interface RecognitionState {
  /** `null` mientras llega. */
  counts: Counts | null;
  earned: Set<string>;
  optIn: boolean | null;
  busy: boolean;
  toggleOptIn: (next: boolean) => void;
}

export function useRecognition(userId: string | null): RecognitionState {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [earned, setEarned] = useState<Set<string>>(() => new Set());
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !userId) return;
    let vivo = true;
    void Promise.all([
      fetchMyContributions(sb),
      fetchMyBadges(sb),
      sb.from("profiles").select("leaderboard_opt_in").eq("user_id", userId).maybeSingle(),
    ]).then(([rows, badges, perfil]) => {
      if (!vivo) return;
      setCounts(countContributions(rows));
      setEarned(new Set(badges.map((b) => b.badge)));
      setOptIn(Boolean((perfil.data as { leaderboard_opt_in?: boolean } | null)?.leaderboard_opt_in));
    });
    return () => {
      vivo = false;
    };
  }, [userId]);

  const toggleOptIn = useCallback(
    (next: boolean) => {
      const sb = getSupabase();
      if (!sb || !userId) return;
      setBusy(true);
      // Optimista: el interruptor responde al dedo y se corrige si la escritura falla.
      setOptIn(next);
      setLeaderboardOptIn(sb, userId, next)
        .catch(() => setOptIn(!next))
        .finally(() => setBusy(false));
    },
    [userId],
  );

  return { counts, earned, optIn, busy, toggleOptIn };
}

/** Cuántas medallas hay en total: el «de 6» de «2 de 6». */
export const BADGE_TOTAL = BADGES.length;

/** El nivel de esta persona, o `null` mientras no llegan sus contribuciones. */
export function levelOf(rec: RecognitionState) {
  return rec.counts ? levelFor(rec.counts.xp) : null;
}

/**
 * La sección «Logros»: cómo se sube, las medallas y la tabla de posiciones. El nivel en sí
 * va en la tarjeta de arriba de la cuenta.
 */
export function AchievementsSection({ rec }: { rec: RecognitionState }) {
  const { t } = useI18n();

  if (!rec.counts) {
    return (
      <div className="rec" aria-busy="true">
        <span className="skel rec-skel" aria-hidden="true" />
        <span className="skel rec-skel" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="rec">
      {/* CÓMO SE SUBE, con los números a la vista. Sin verla, «te faltan 30» no dice si
          eso son treinta toques de botón o dos visitas. De más a menos: lo primero que se
          lee es lo que de verdad mueve el nivel. */}
      <h4 className="rec-sub rec-sub-first">{t("rec.how")}</h4>
      <ul className="rec-how">
        {(Object.keys(ACTION_POINTS) as ContributionKind[])
          .sort((a, b) => ACTION_POINTS[b] - ACTION_POINTS[a])
          .map((kind) => (
            <li key={kind} className="rec-how-row">
              <span className="rec-how-txt">{t(`action.${kind}` as const)}</span>
              <span className="rec-how-pts">+{ACTION_POINTS[kind]}</span>
            </li>
          ))}
      </ul>

      <h4 className="rec-sub">{t("rec.badges")}</h4>
      {rec.earned.size === 0 ? <p className="rec-empty">{t("rec.noBadges")}</p> : null}

      {/* Se listan TODAS, con las no ganadas apagadas: una medalla que no se ve hasta
          tenerla no invita a nada. */}
      <ul className="rec-badges">
        {BADGES.map((b) => {
          const on = rec.earned.has(b.code);
          const Glyph = Icon[b.icon];
          return (
            <li key={b.code} className={`rec-badge${on ? " rec-badge-on" : ""}`}>
              <span className="rec-badge-ic">
                <Glyph />
              </span>
              <span className="rec-badge-txt">
                <b>{t(b.label)}</b>
                <span>{t(b.hint)}</span>
              </span>
              {on ? null : <span className="rec-tag rec-tag-off">{t("rec.locked")}</span>}
            </li>
          );
        })}
      </ul>

      <label className="rec-opt">
        <input
          type="checkbox"
          checked={rec.optIn === true}
          disabled={rec.busy || rec.optIn === null}
          onChange={(e) => rec.toggleOptIn(e.target.checked)}
        />
        <span className="rec-opt-txt">
          <b>{t("rec.optIn")}</b>
          <span>{t("rec.optInHint")}</span>
        </span>
      </label>
    </div>
  );
}
