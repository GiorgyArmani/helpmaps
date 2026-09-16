import type { CenterStatus } from "@/domain/types";
import type { Translate } from "@/i18n";
import {
  dayName,
  formatHours,
  formatTime,
  hasHours,
  hoursToText,
  openState,
  type WeeklyHours,
} from "@/domain/hours";
import { translator } from "@/i18n";
import { LANGUAGE } from "@/config";

/**
 * El horario de un punto, tal como lo lee quien busca.
 *
 * Sin hooks a propósito: lo pinta la ficha del mapa (cliente) y el perfil público `/c/<id>`
 * (servidor), y las dos le pasan su propio `t`. Un componente con `useI18n` no se podría
 * usar en la segunda.
 *
 * Primero la respuesta —abierto o cerrado ahora, y hasta cuándo— y debajo la semana. Quien
 * abre la ficha a las siete de la tarde no quiere deducir de «lun–vie 08:00–17:00» si le
 * da tiempo: quiere leer «Cerrado ahora · abre mañana a las 8:00».
 */
export default function HoursView({
  hours,
  schedule,
  status,
  t,
  lang,
  now,
}: {
  hours: WeeklyHours | null;
  /** El texto de antes. Sólo se muestra si no hay horario marcado. */
  schedule: string | null;
  /** Si el punto dijo que está cerrado, «abierto ahora» mentiría: no se muestra. */
  status?: CenterStatus | null;
  t: Translate;
  lang: string;
  now?: Date;
}) {
  if (!hasHours(hours)) {
    return schedule ? <span>{schedule}</span> : null;
  }

  const words = { everyDay: t("hours.everyDay"), allDay: t("hours.allDay") };
  const lines = formatHours(hours, lang, words);
  const state = status === "cerrado" ? null : openState(hours, now);

  let when = "";
  if (state?.open) {
    when = state.closesAt ? t("hours.closesAt", { time: formatTime(state.closesAt, lang) }) : "";
  } else if (state?.next) {
    const time = formatTime(state.next.at, lang);
    when = state.next.today
      ? t("hours.opensToday", { time })
      : state.next.tomorrow
        ? t("hours.opensTomorrow", { time })
        : t("hours.opensOn", { day: dayName(state.next.day, lang, "long").toLowerCase(), time });
  }

  return (
    <span className="hours">
      {state ? (
        <span className={`hours-now${state.open ? " hours-now-open" : ""}`}>
          <span className="hours-dot" aria-hidden="true" />
          <b>{state.open ? t("hours.openNow") : t("hours.closedNow")}</b>
          {when ? <span className="hours-when"> · {when}</span> : null}
        </span>
      ) : null}
      <span className="hours-week">
        {lines.map((l) => (
          <span key={`${l.days}${l.shifts}`} className="hours-line">
            {l.days ? <span className="hours-days">{l.days}</span> : null}
            <span className="hours-shifts">{l.shifts}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * El resumen en texto que se guarda en `schedule` junto al horario marcado.
 *
 * En el idioma BASE del despliegue y no en el de quien edita: esa columna la leen la API
 * pública y las fichas que todavía no conocen `hours`, y un comedor de Caracas no debería
 * quedar descrito en inglés porque su gestora tenía el teléfono en inglés.
 */
export function scheduleText(hours: WeeklyHours | null): string | null {
  if (!hasHours(hours)) return null;
  const t = translator(LANGUAGE.default);
  return hoursToText(hours, LANGUAGE.default, {
    everyDay: t("hours.everyDay"),
    allDay: t("hours.allDay"),
  });
}
