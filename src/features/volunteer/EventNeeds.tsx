"use client";

import type { Activity } from "@/domain/types";
import { matchingSkills, type EventNeed, type Skill } from "@/domain/volunteer";
import type { DictKey } from "@/i18n";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";

/** Un icono por forma de ayudar: el mismo en el formulario y en el evento publicado. */
export function needIcon(need: EventNeed) {
  switch (need) {
    case "hands":
      return <Icon.hand />;
    case "skills":
      return <Icon.volunteer />;
    case "in_kind":
      return <Icon.box />;
    case "spread":
      return <Icon.share />;
  }
}

export const skillLabel = (s: Skill) => `vol.skill.${s}` as DictKey;

/**
 * Lo que le falta a un evento, dicho para quien viene a ayudar.
 *
 * Si la persona tiene sesión y dijo qué sabe hacer, y el evento busca justo eso, va una
 * línea aparte y primero: es el puente entero en una frase —«buscan lo que sabes hacer»—
 * y no puede quedar perdido entre las etiquetas. La coincidencia se calcula aquí, con el
 * perfil que ya está en memoria: nadie le pregunta al servidor a quién le sirve qué.
 */
export default function EventNeeds({ activity, mySkills }: { activity: Activity; mySkills: readonly Skill[] }) {
  const { t } = useI18n();
  const { needs, skills } = activity;
  if (needs.length === 0) return null;

  const match = matchingSkills(needs, skills, mySkills);

  return (
    <span className="ineeds">
      {match.length > 0 ? (
        <span className="ineeds-match">
          <Icon.spark />
          <span>
            <b>{t("event.youMatch")}</b>
            {": "}
            {match.map((s) => t(skillLabel(s))).join(", ")}
          </span>
        </span>
      ) : null}
      <span className="ineeds-tags">
        {needs.map((n) => (
          <span key={n} className="ineed">
            {needIcon(n)}
            {t(`event.needLong.${n}` as DictKey)}
            {n === "skills" && skills.length > 0 ? `: ${skills.map((s) => t(skillLabel(s))).join(", ")}` : null}
          </span>
        ))}
      </span>
    </span>
  );
}
