"use client";

import { useEffect, useState } from "react";
import {
  BADGES,
  countContributions,
  earnedBadges,
  levelFor,
  type Counts,
} from "@/domain/badges";
import {
  awardBadge,
  fetchMyBadges,
  fetchMyContributions,
  setLeaderboardOptIn,
  type AwardedBadge,
} from "@/data/recognition";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Lo que alguien ha aportado: su nivel, su experiencia y sus medallas.
 *
 * ── EL NIVEL MANDA, LAS MEDALLAS ACOMPAÑAN ──────────────────────────────────
 *
 * Lo primero y lo más grande es el nivel, con la barra de lo que falta para el siguiente:
 * es lo que una persona enseña y lo que un comercio aliado mirará para dar su beneficio.
 * Las medallas van debajo, como hitos de lo que hizo — no se canjean por nada, y por eso
 * no compiten con el nivel por el sitio de arriba.
 *
 * Vive DENTRO de «Mi cuenta», no en una pantalla propia. Es lo mismo que se decidió para
 * el resto: las funciones van en el panel del mapa, y una página aparte para las medallas
 * las convertiría en un sitio al que hay que ir en vez de algo que se ve al mirar lo tuyo.
 *
 * ── LAS MEDALLAS SE CALCULAN AQUÍ Y SE GUARDAN ALLÍ ─────────────────────────
 *
 * La regla de cada medalla está en `src/domain/badges.ts` y se evalúa en el cliente sobre
 * las contribuciones de esta persona —que son las únicas que puede leer—. Lo que se
 * guarda en `user_badges` es el hecho de haberla ganado, con su fecha.
 *
 * Que el cliente decida cuándo se gana no es un agujero: `award_badge` sólo puede otorgar
 * a quien llama, las medallas no dan permisos y no se pueden cambiar por nada dentro de
 * la aplicación. Lo que sí se protege es la MONEDA —los puntos—, que no se pueden escribir
 * desde el cliente en absoluto (ver la nota de `contributions` en la migración). El día
 * que una medalla valga un beneficio real en un comercio, la comprobación se muda al
 * servidor; hasta entonces esto es lo proporcionado.
 *
 * ── APARECER EN LA LISTA ES OPT-IN, Y SE DICE QUÉ SE PUBLICA ────────────────
 *
 * El interruptor explica que se vería el nombre y el total, y que NO se publica dónde
 * estuvo nadie. Es la primera pregunta que se hace cualquiera antes de marcarlo, y en
 * este país no es una pregunta ociosa.
 */
export default function Recognition({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [mine, setMine] = useState<AwardedBadge[]>([]);
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void Promise.all([
      fetchMyContributions(sb),
      fetchMyBadges(sb),
      sb.from("profiles").select("leaderboard_opt_in").eq("user_id", userId).maybeSingle(),
    ]).then(([rows, badges, perfil]) => {
      if (!vivo) return;
      const c = countContributions(rows);
      setCounts(c);
      setMine(badges);
      setOptIn(Boolean((perfil.data as { leaderboard_opt_in?: boolean } | null)?.leaderboard_opt_in));

      // Otorgar lo que se haya ganado y no esté registrado. `award_badge` es idempotente,
      // así que esto no puede duplicar nada ni mover una fecha ya puesta.
      const tiene = new Set(badges.map((b) => b.badge));
      const nuevas = earnedBadges(c).filter((b) => !tiene.has(b.code));
      if (nuevas.length === 0) return;
      void Promise.all(nuevas.map((b) => awardBadge(sb, b.code))).then(() =>
        fetchMyBadges(sb).then((frescas) => {
          if (vivo) setMine(frescas);
        }),
      );
    });
    return () => {
      vivo = false;
    };
  }, [userId]);

  if (!counts) return null;

  const nivel = levelFor(counts.xp);
  const ganadas = new Set(mine.map((b) => b.badge));

  async function toggleOptIn(next: boolean) {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    // Optimista: el interruptor responde al dedo y se corrige si la escritura falla.
    setOptIn(next);
    try {
      await setLeaderboardOptIn(sb, userId, next);
    } catch {
      setOptIn(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rec">
      <h3 className="acc-h">{t("rec.title")}</h3>

      {counts.total === 0 ? (
        <p className="rec-empty">{t("rec.empty")}</p>
      ) : (
        <div className="rec-level">
          <div className="rec-level-head">
            <span className="rec-badge-lvl">{nivel.level}</span>
            <span className="rec-level-txt">
              <b>{t(nivel.label)}</b>
              <span className="rec-pts">
                {counts.xp === 1 ? t("rec.xpOne") : t("rec.xp", { n: counts.xp })}
              </span>
            </span>
          </div>

          {/* La barra dice lo que el número solo no puede: si estás cerca. El último tramo
              es doce veces el primero, así que «faltan 40» significa cosas muy distintas
              según dónde estés. */}
          <div
            className="rec-bar"
            role="progressbar"
            aria-valuenow={Math.round(nivel.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t(nivel.label)}
          >
            <span className="rec-bar-fill" style={{ width: `${Math.round(nivel.progress * 100)}%` }} />
          </div>

          <span className="rec-next">
            {nivel.next && nivel.toNext !== null
              ? t("rec.toNext", { n: nivel.toNext, level: t(nivel.next.label) })
              : t("rec.maxLevel")}
          </span>
        </div>
      )}

      <h4 className="rec-sub">{t("rec.badges")}</h4>
      {ganadas.size === 0 ? <p className="rec-empty">{t("rec.noBadges")}</p> : null}

      {/* Se listan TODAS, con las no ganadas apagadas: una medalla que no se ve hasta
          tenerla no invita a nada. Enseñar lo que falta es la mitad de por qué funciona. */}
      <ul className="rec-badges">
        {BADGES.map((b) => {
          const on = ganadas.has(b.code);
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
          checked={optIn === true}
          disabled={busy || optIn === null}
          onChange={(e) => void toggleOptIn(e.target.checked)}
        />
        <span className="rec-opt-txt">
          <b>{t("rec.optIn")}</b>
          <span>{t("rec.optInHint")}</span>
        </span>
      </label>
    </section>
  );
}
