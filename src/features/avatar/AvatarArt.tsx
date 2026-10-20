"use client";

import { memo } from "react";
import type { Avatar, Slot } from "@/domain/avatar";
import type { DictKey, Translate } from "@/i18n";
import { useI18n } from "@/i18n/context";
import { cardSvg, discSvg, sceneSvg, type Mood } from "@/features/avatar/art";

/**
 * «Chigüire en los Llanos con franela lisa azul y gorra roja». Es lo que oye un lector de
 * pantalla en lugar del dibujo, y por eso nombra todo lo que se ve.
 */
export function describeAvatar(t: Translate, av: Avatar): string {
  const parts: string[] = [];
  for (const slot of ["ropa", "cabeza", "cara", "cuello", "cuerpo"] as Slot[]) {
    const p = av[slot];
    if (!p) continue;
    const name = t(`avatar.item.${p.id}` as DictKey).toLowerCase();
    parts.push(p.c ? `${name} ${t(`avatar.color.${p.c}` as DictKey).toLowerCase()}` : name);
  }
  const base = t("avatar.describe", {
    species: t(`avatar.sp.${av.sp}` as DictKey),
    habitat: t(`avatar.hab.${av.hab}` as DictKey),
  });
  return parts.length ? `${base} ${t("avatar.with", { list: parts.join(", ") })}` : base;
}

/**
 * El avatar de cuerpo entero. Reserva su proporción (120:150) antes de dibujar, así que
 * nunca empuja lo que hay debajo.
 */
export const AvatarCard = memo(function AvatarCard({
  avatar,
  mood = "neutral",
  className,
}: {
  avatar: Avatar;
  mood?: Mood;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={className ? `ave-card ${className}` : "ave-card"}
      role="img"
      aria-label={describeAvatar(t, avatar)}
      dangerouslySetInnerHTML={{ __html: cardSvg(avatar, mood) }}
    />
  );
});

/**
 * Recortado a la cabeza, dentro de un disco. Lo pinta quien lo contiene (`.avatar`, un
 * botón de especie…): éste sólo llena el círculo.
 *
 * `label` en `null` lo deja mudo para cuando el botón que lo envuelve ya dice qué es.
 */
export const AvatarDisc = memo(function AvatarDisc({
  avatar,
  mood = "neutral",
  label,
}: {
  avatar: Avatar;
  mood?: Mood;
  label?: string | null;
}) {
  const { t } = useI18n();
  const name = label === undefined ? describeAvatar(t, avatar) : label;
  return (
    <span
      className="ave-disc"
      {...(name ? { role: "img", "aria-label": name } : { "aria-hidden": true })}
      dangerouslySetInnerHTML={{ __html: discSvg(avatar, mood) }}
    />
  );
});

/**
 * La escena: el hábitat de borde a borde con el personaje parado en su suelo. Es el
 * escenario del creador y del paso del nombre. Llena su caja (la proporción la decide quien
 * la contiene) recortando cielo, nunca al personaje.
 */
export const AvatarScene = memo(function AvatarScene({
  avatar,
  mood = "neutral",
  className,
}: {
  avatar: Avatar;
  mood?: Mood;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={className ? `ave-sceneart ${className}` : "ave-sceneart"}
      role="img"
      aria-label={describeAvatar(t, avatar)}
      dangerouslySetInnerHTML={{ __html: sceneSvg(avatar, mood) }}
    />
  );
});
