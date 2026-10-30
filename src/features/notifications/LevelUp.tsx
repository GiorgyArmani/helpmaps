"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { levelFor } from "@/domain/badges";
import { ITEMS, type Avatar, type Slot } from "@/domain/avatar";
import { AvatarCard } from "@/features/avatar/AvatarArt";
import type { DictKey } from "@/i18n";

/**
 * La celebración de subir de nivel.
 *
 * ── POR QUÉ UNA PANTALLA Y NO UNA LÍNEA MÁS EN LA BANDEJA ────────────────────
 *
 * El nivel es lo único de esta app que se gana saliendo de casa: visitar un punto, ir a una
 * jornada, aportar. Ese esfuerzo merece un momento propio, y es el momento en que se decide
 * si alguien vuelve. Por eso sale sola, una vez, con el avatar de la persona en el centro
 * —es SU logro, no un trofeo genérico— y con lo que acaba de desbloquear puesto encima.
 *
 * ── CUÁNDO SALE ─────────────────────────────────────────────────────────────
 *
 * Cuando el nivel calculado supera al último celebrado EN ESTE TELÉFONO (`localStorage`,
 * por cuenta). Igual que «visto» en la bandeja: no merece una columna, y lo peor que pasa
 * al cambiar de teléfono es no volver a ver una fiesta vieja. La primera vez que una cuenta
 * abre la app no se celebra nada viejo, salvo que la subida sea de los últimos tres días.
 *
 * ── MOVIMIENTO ──────────────────────────────────────────────────────────────
 *
 * Todo es `transform` y `opacity`, y con `prefers-reduced-motion` no se mueve nada: la
 * tarjeta aparece quieta con la misma información. No bloquea: se cierra con el botón, con
 * Escape o tocando fuera.
 */

const seenKey = (uid: string) => `hmLevelSeen:${uid}`;
const RECENT_MS = 3 * 86_400_000;

function readSeen(uid: string): number | null {
  try {
    const v = window.localStorage.getItem(seenKey(uid));
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeSeen(uid: string, level: number): void {
  try {
    window.localStorage.setItem(seenKey(uid), String(level));
  } catch {
    /* modo privado: la fiesta puede repetirse al recargar, y no pasa nada */
  }
}

/** La pieza especial que abre este nivel, si abre alguna. */
function unlockFor(level: number) {
  return ITEMS.find((i) => i.lock === level) ?? null;
}

/** El avatar de la persona con la pieza nueva puesta: la vista previa de lo ganado. */
function wearing(av: Avatar, slot: Slot, id: string): Avatar {
  return { ...av, [slot]: { id } };
}

/** Decide si hay que celebrar y qué nivel. `null` mientras no haya nada que festejar. */
export function useLevelUp(uid: string | null, xp: number | null, lastLevelAt: string | null) {
  const [show, setShow] = useState<number | null>(null);

  // La regla avisa de un setState dentro de un efecto. Aquí es lo que corresponde: lo que
  // decide es `localStorage`, un sistema externo que no se puede leer durante el render
  // (en el servidor no existe), así que se lee al montar y se sincroniza el estado.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!uid || xp === null) return;
    const level = levelFor(xp).level;
    const seen = readSeen(uid);
    if (seen === null) {
      const recent = lastLevelAt !== null && Date.now() - Date.parse(lastLevelAt) < RECENT_MS;
      if (recent && level > 1) setShow(level);
      else writeSeen(uid, level);
      return;
    }
    if (level > seen) setShow(level);
  }, [uid, xp, lastLevelAt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const close = useCallback(() => {
    if (uid && show !== null) writeSeen(uid, show);
    setShow(null);
  }, [uid, show]);

  return { level: show, close };
}

const CONFETTI = 16;

export default function LevelUp({
  level,
  xp,
  avatar,
  onClose,
  onWear,
}: {
  level: number;
  xp: number;
  avatar: Avatar | null;
  onClose: () => void;
  /** Abrir el editor del avatar para ponerse lo desbloqueado. */
  onWear: () => void;
}) {
  const { t } = useI18n();
  const cta = useRef<HTMLButtonElement>(null);
  const info = levelFor(xp);
  const unlock = unlockFor(level);
  const preview = useMemo(
    () => (avatar && unlock ? wearing(avatar, unlock.slot, unlock.id) : avatar),
    [avatar, unlock],
  );

  useEffect(() => {
    cta.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Un toque corto en el teléfono, sólo si quien lo usa no pidió menos movimiento.
    try {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate?.([30, 50, 30]);
    } catch {
      /* sin vibración */
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="lvl-scrim" onClick={onClose}>
      <div
        className="lvl-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lvl-title"
        aria-describedby="lvl-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lvl-stage">
          <span className="lvl-rays" aria-hidden="true" />
          <span className="lvl-confetti" aria-hidden="true">
            {Array.from({ length: CONFETTI }, (_, i) => (
              <i key={i} style={{ ["--i" as string]: i }} />
            ))}
          </span>
          {preview ? (
            <AvatarCard avatar={preview} mood="feliz" className="lvl-ave" />
          ) : (
            <span className="lvl-medal" aria-hidden="true">
              <Icon.spark />
            </span>
          )}
          <span className="lvl-num" aria-hidden="true">
            {level}
          </span>
        </div>

        <p className="lvl-kicker">{t("levelup.kicker")}</p>
        <h2 id="lvl-title" className="lvl-title">
          {t(`level.${level}` as DictKey)}
        </h2>
        <p id="lvl-desc" className="lvl-desc">
          {info.next && info.toNext !== null
            ? t("levelup.next", { n: info.toNext, level: t(info.next.label) })
            : t("levelup.max")}
        </p>

        {unlock ? (
          <p className="lvl-unlock">
            <Icon.spark />
            <span>{t("levelup.unlocked", { item: t(`avatar.item.${unlock.id}` as DictKey) })}</span>
          </p>
        ) : null}

        <div className="lvl-actions">
          {unlock && avatar ? (
            <button
              ref={cta}
              type="button"
              className="btnp"
              onClick={() => {
                onClose();
                onWear();
              }}
            >
              {t("levelup.wear")}
            </button>
          ) : null}
          <button ref={unlock && avatar ? undefined : cta} type="button" className={unlock && avatar ? "btng" : "btnp"} onClick={onClose}>
            {t("levelup.keep")}
          </button>
        </div>
      </div>
    </div>
  );
}
