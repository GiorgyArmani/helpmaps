"use client";

import { useState } from "react";
import {
  DAY_KEYS,
  browserTimeZone,
  dayName,
  hasHours,
  isAllDay,
  toMinutes,
  type DayKey,
  type Shift,
  type WeeklyHours,
} from "@/domain/hours";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

const DEFAULT_SHIFT: Shift = ["08:00", "17:00"];
const ALL_DAY: Shift = ["00:00", "24:00"];
const MAX_SHIFTS = 3;
const WEEKDAYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

/**
 * Marcar el horario: qué días y a qué horas.
 *
 * ── LA FORMA DEL CONTROL ───────────────────────────────────────────────────
 *
 * Primero los días, como siete botones grandes: es la pregunta que se contesta con el
 * pulgar y sin pensar. Después las horas, y por defecto UNA sola fila para todos los días
 * marcados, porque así es casi todo horario real («de lunes a viernes de 8 a 5»). Quien
 * tiene el sábado distinto desmarca «el mismo horario» y le aparece una fila por día.
 *
 * Las horas son `<input type="time">`: en un teléfono abre la rueda del sistema, que ya
 * sabe si ahí se dice «5 p. m.» o «17:00», y no hay que escribir nada.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────
 *
 * No impide un cierre anterior a la apertura: es un turno que cruza la medianoche (un
 * comedor nocturno de 20:00 a 02:00), y se avisa en vez de rechazarlo. Sí avisa si las dos
 * horas son iguales, que no es un horario sino un descuido.
 */
export default function HoursPicker({
  value,
  onChange,
  legacyText,
}: {
  value: WeeklyHours | null;
  onChange: (next: WeeklyHours | null) => void;
  /** El horario escrito a mano de antes, para enseñarlo mientras no se marque el nuevo. */
  legacyText?: string | null;
}) {
  const { t, lang } = useI18n();
  const days = value?.days ?? {};
  const open = DAY_KEYS.filter((d) => (days[d]?.length ?? 0) > 0);

  // «El mismo horario» arranca encendido si lo que hay ya es igual en todos los días —o si
  // no hay nada— y apagado si alguien ya había puesto un sábado distinto.
  const [same, setSame] = useState(() => {
    const first = open[0] ? days[open[0]] : undefined;
    return open.every((d) => JSON.stringify(days[d]) === JSON.stringify(first));
  });

  function emit(nextDays: WeeklyHours["days"]) {
    const next: WeeklyHours = { tz: value?.tz ?? browserTimeZone(), days: nextDays };
    onChange(hasHours(next) ? next : null);
  }

  /** Los turnos que recibe un día que se acaba de marcar. */
  function template(): Shift[] {
    const first = open[0] ? days[open[0]] : undefined;
    return first ? first.map((s) => [s[0], s[1]] as Shift) : [[...DEFAULT_SHIFT]];
  }

  function toggleDay(day: DayKey) {
    const next = { ...days };
    if (next[day]?.length) delete next[day];
    else next[day] = template();
    emit(next);
  }

  function setDays(list: DayKey[]) {
    const shifts = template();
    const next: WeeklyHours["days"] = {};
    for (const d of list) next[d] = shifts.map((s) => [s[0], s[1]] as Shift);
    setSame(true);
    emit(next);
  }

  function setShifts(target: DayKey[] | "all", shifts: Shift[]) {
    const next = { ...days };
    for (const d of target === "all" ? open : target) next[d] = shifts.map((s) => [s[0], s[1]] as Shift);
    emit(next);
  }

  function toggleSame(on: boolean) {
    setSame(on);
    // Al volver a «el mismo», manda el primero: es el que la persona tiene delante.
    if (on && open[0]) setShifts("all", days[open[0]] ?? [[...DEFAULT_SHIFT]]);
  }

  const presetWeekdays =
    open.length === WEEKDAYS.length && WEEKDAYS.every((d) => open.includes(d));
  const presetAll = open.length === 7;

  return (
    <div className="hpick">
      <span className="flabel">{t("hours.days")}</span>
      <div className="hpick-days" role="group" aria-label={t("hours.days")}>
        {DAY_KEYS.map((d) => {
          const on = open.includes(d);
          return (
            <button
              key={d}
              type="button"
              className={`hpick-day${on ? " hpick-day-on" : ""}`}
              aria-pressed={on}
              aria-label={dayName(d, lang, "long")}
              onClick={() => toggleDay(d)}
            >
              {dayName(d, lang, "short").slice(0, 3)}
            </button>
          );
        })}
      </div>

      <div className="hpick-presets">
        <button
          type="button"
          className={`hpick-preset${presetWeekdays ? " hpick-preset-on" : ""}`}
          aria-pressed={presetWeekdays}
          onClick={() => setDays(WEEKDAYS)}
        >
          {t("hours.weekdays")}
        </button>
        <button
          type="button"
          className={`hpick-preset${presetAll ? " hpick-preset-on" : ""}`}
          aria-pressed={presetAll}
          onClick={() => setDays([...DAY_KEYS])}
        >
          {t("hours.everyDay")}
        </button>
      </div>

      {open.length === 0 ? (
        <p className="fhint">{t("hours.pickDay")}</p>
      ) : (
        <>
          {open.length > 1 ? (
            <label className="mine-check">
              <input type="checkbox" checked={same} onChange={(e) => toggleSame(e.target.checked)} />
              {t("hours.sameAll")}
            </label>
          ) : null}

          {same || open.length === 1 ? (
            <ShiftRows shifts={days[open[0] as DayKey] ?? []} onChange={(s) => setShifts("all", s)} />
          ) : (
            open.map((d) => (
              <div key={d} className="hpick-daygroup">
                <span className="hpick-dayname">{dayName(d, lang, "long")}</span>
                <ShiftRows shifts={days[d] ?? []} onChange={(s) => setShifts([d], s)} />
              </div>
            ))
          )}
        </>
      )}

      {!hasHours(value) && legacyText ? (
        <p className="fhint hpick-legacy">{t("hours.legacy", { text: legacyText })}</p>
      ) : null}
    </div>
  );
}

function ShiftRows({ shifts, onChange }: { shifts: Shift[]; onChange: (next: Shift[]) => void }) {
  const { t } = useI18n();
  const allDay = isAllDay(shifts);

  function update(i: number, part: 0 | 1, v: string) {
    if (!v) return;
    onChange(shifts.map((s, j) => (j === i ? ((part === 0 ? [v, s[1]] : [s[0], v]) as Shift) : s)));
  }

  return (
    <div className="hpick-shifts">
      <label className="mine-check">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => onChange(e.target.checked ? [[...ALL_DAY]] : [[...DEFAULT_SHIFT]])}
        />
        {t("hours.allDay")}
      </label>

      {allDay
        ? null
        : shifts.map((s, i) => {
            const sameTime = s[0] === s[1];
            const overnight = !sameTime && toMinutes(s[1]) < toMinutes(s[0]);
            return (
              <div key={i} className="hpick-shift">
                <div className="hpick-row">
                  <label className="hpick-time">
                    <span className="flabel">{t("hours.from")}</span>
                    <input
                      className="finput"
                      type="time"
                      step={900}
                      value={s[0]}
                      onChange={(e) => update(i, 0, e.target.value)}
                    />
                  </label>
                  <label className="hpick-time">
                    <span className="flabel">{t("hours.to")}</span>
                    <input
                      className="finput"
                      type="time"
                      step={900}
                      value={s[1] === "24:00" ? "23:59" : s[1]}
                      onChange={(e) => update(i, 1, e.target.value)}
                    />
                  </label>
                  {shifts.length > 1 ? (
                    <button
                      type="button"
                      className="hpick-remove"
                      aria-label={t("hours.removeShift")}
                      title={t("hours.removeShift")}
                      onClick={() => onChange(shifts.filter((_, j) => j !== i))}
                    >
                      <Icon.close />
                    </button>
                  ) : null}
                </div>
                {sameTime ? (
                  <p className="hpick-warn" role="status">
                    {t("hours.sameTime")}
                  </p>
                ) : overnight ? (
                  <p className="fhint">{t("hours.overnight")}</p>
                ) : null}
              </div>
            );
          })}

      {!allDay && shifts.length < MAX_SHIFTS ? (
        <button
          type="button"
          className="hpick-add"
          onClick={() => {
            const last = shifts[shifts.length - 1];
            // El turno nuevo empieza una hora después de que cierre el anterior: la tarde
            // tras la mañana, que es por lo que casi siempre se añade.
            const start = last ? Math.min(toMinutes(last[1]) + 60, 22 * 60) : 8 * 60;
            const hhmm = (m: number) =>
              `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
            onChange([...shifts, [hhmm(start), hhmm(Math.min(start + 180, 23 * 60 + 45))]]);
          }}
        >
          <Icon.plus />
          {t("hours.addShift")}
        </button>
      ) : null}
    </div>
  );
}
