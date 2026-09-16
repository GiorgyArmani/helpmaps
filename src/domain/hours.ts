// El horario de atención de un punto, como dato y no como frase.
//
// ── POR QUÉ DEJA DE SER TEXTO ──────────────────────────────────────────────
//
// `center_info.schedule` es texto libre, y en la base real se lee «L-V 8 a 4», «lunes a
// viernes de 8am a 4pm», «todos los días», «mañanas». Una persona lo entiende; la app no.
// No puede decir «abierto ahora», no puede traducirlo, y quien lo escribe no tiene nada que
// le recuerde el sábado. Con días y horas marcados, las tres cosas salen solas.
//
// ── LA FORMA GUARDADA ──────────────────────────────────────────────────────
//
//   { "tz": "America/Caracas", "days": { "mon": [["08:00","17:00"]], "sat": [...] } }
//
// Un día sin entrada está cerrado. Cada turno es [desde, hasta] en "HH:MM" de 24 horas;
// "24:00" como fin es «hasta medianoche», y un turno cuyo fin es MENOR que su inicio
// cruza la medianoche (un comedor nocturno de 20:00 a 02:00).
//
// La zona horaria viaja CON el horario y la pone el navegador de quien lo guarda, que es
// quien está en el punto. «Abierto ahora» tiene que calcularse en la hora del lugar, no en
// la de quien mira: un venezolano en Madrid consultando un comedor de Caracas vería el
// comedor cerrado a mediodía de allí. Guardarla aquí evita además un dato más en la
// configuración de cada país — y un país con dos husos (Indonesia) queda bien sin más.

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** El día en la posición `i` de la semana, dando la vuelta: `dayAt(-1)` es domingo. */
export function dayAt(i: number): DayKey {
  return DAY_KEYS[((i % 7) + 7) % 7] as DayKey;
}

/** [desde, hasta] en "HH:MM". */
export type Shift = [string, string];

export interface WeeklyHours {
  /** Zona IANA del punto. Null en datos viejos: se cae a la de quien mira. */
  tz: string | null;
  days: Partial<Record<DayKey, Shift[]>>;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** Minutos desde medianoche. "24:00" → 1440. */
export function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isShift(v: unknown): v is Shift {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "string" &&
    typeof v[1] === "string" &&
    HHMM.test(v[0]) &&
    HHMM.test(v[1]) &&
    v[0] !== v[1] &&
    v[0] !== "24:00"
  );
}

/**
 * Lee lo que venga de la base. Es jsonb: se valida todo y lo que no encaja se descarta
 * en silencio, porque un turno mal formado no puede dejar a una ficha sin dibujarse.
 */
export function parseHours(v: unknown): WeeklyHours | null {
  if (!v || typeof v !== "object") return null;
  const raw = v as { tz?: unknown; days?: unknown };
  if (!raw.days || typeof raw.days !== "object") return null;
  const days: WeeklyHours["days"] = {};
  for (const key of DAY_KEYS) {
    const list = (raw.days as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    const shifts = list.filter(isShift).map((s) => [s[0], s[1]] as Shift);
    if (shifts.length > 0) days[key] = shifts.sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  }
  const tz = typeof raw.tz === "string" && raw.tz ? raw.tz : null;
  const out: WeeklyHours = { tz, days };
  return hasHours(out) ? out : null;
}

export function hasHours(h: WeeklyHours | null | undefined): h is WeeklyHours {
  return Boolean(h && DAY_KEYS.some((d) => (h.days[d]?.length ?? 0) > 0));
}

export function isAllDay(shifts: Shift[] | undefined): boolean {
  const only = shifts?.length === 1 ? shifts[0] : undefined;
  return Boolean(only && only[0] === "00:00" && only[1] === "24:00");
}

/** La zona del navegador. Es la que se guarda: quien edita el horario está en el punto. */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// ── Agrupar ────────────────────────────────────────────────────────────────

export interface DayGroup {
  days: DayKey[];
  shifts: Shift[];
}

function sameShifts(a: Shift[] | undefined, b: Shift[] | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((s, i) => s[0] === b[i]?.[0] && s[1] === b[i]?.[1]);
}

/**
 * Días SEGUIDOS con los mismos turnos, juntos: «lun–vie 08:00–17:00» en vez de cinco
 * líneas iguales. Sólo seguidos: lunes y miércoles con el mismo horario y el martes
 * cerrado son dos líneas, porque «lun–mié» diría que el martes abre.
 */
export function groupDays(h: WeeklyHours): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const day of DAY_KEYS) {
    const shifts = h.days[day];
    if (!shifts?.length) continue;
    const last = groups[groups.length - 1];
    const prevDay = DAY_KEYS.indexOf(day) > 0 ? dayAt(DAY_KEYS.indexOf(day) - 1) : null;
    if (last && last.days[last.days.length - 1] === prevDay && sameShifts(last.shifts, shifts)) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], shifts });
    }
  }
  return groups;
}

// ── Nombres y formato ──────────────────────────────────────────────────────

export function localeFor(lang: string): string {
  return lang === "en" ? "en-US" : lang === "pt" ? "pt-BR" : "es-VE";
}

/**
 * El nombre del día sale de `Intl`, no de un diccionario: son siete palabras que todos los
 * navegadores ya saben decir en cada idioma. El 1 de enero de 2024 fue lunes.
 */
export function dayName(day: DayKey, lang: string, width: "short" | "long" | "narrow" = "short"): string {
  const d = new Date(Date.UTC(2024, 0, 1 + DAY_KEYS.indexOf(day), 12));
  const name = new Intl.DateTimeFormat(localeFor(lang), { weekday: width, timeZone: "UTC" })
    .format(d)
    .replace(".", "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "17:00" → «5:00 p. m.» o «17:00», según el idioma. "24:00" se escribe como medianoche. */
export function formatTime(hhmm: string, lang: string): string {
  const mins = toMinutes(hhmm) % 1440;
  const d = new Date(Date.UTC(2024, 0, 1, Math.floor(mins / 60), mins % 60));
  return new Intl.DateTimeFormat(localeFor(lang), {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export function formatDays(days: DayKey[], lang: string): string {
  if (days.length === 7) return "";
  const first = days[0];
  const last = days[days.length - 1];
  if (days.length >= 3 && first && last) return `${dayName(first, lang)}–${dayName(last, lang)}`;
  return days.map((d) => dayName(d, lang)).join(", ");
}

export function formatShifts(shifts: Shift[], lang: string, allDay: string): string {
  if (isAllDay(shifts)) return allDay;
  return shifts.map((s) => `${formatTime(s[0], lang)}–${formatTime(s[1], lang)}`).join(", ");
}

/**
 * Una línea por grupo de días. `everyDay` y `allDay` llegan traducidos: esto vive en el
 * dominio y no conoce el diccionario.
 */
export function formatHours(
  h: WeeklyHours,
  lang: string,
  words: { everyDay: string; allDay: string },
): { days: string; shifts: string }[] {
  return groupDays(h).map((g) => ({
    days: g.days.length === 7 ? words.everyDay : formatDays(g.days, lang),
    shifts: formatShifts(g.shifts, lang, words.allDay),
  }));
}

/**
 * El horario como una sola frase, en el idioma base del despliegue. Se escribe TAMBIÉN en
 * `schedule` al guardar: lo leen la API pública, los clientes que aún no conocen `hours` y
 * cualquier base que todavía no corrió `db/12_horario.sql`.
 */
export function hoursToText(h: WeeklyHours, lang: string, words: { everyDay: string; allDay: string }): string {
  return formatHours(h, lang, words)
    .map((l) => `${l.days} ${l.shifts}`)
    .join(" · ");
}

// ── ¿Abierto ahora? ────────────────────────────────────────────────────────

export interface OpenState {
  open: boolean;
  /** Si está abierto: a qué hora cierra ("HH:MM"). Null si no cierra hoy (24 h). */
  closesAt: string | null;
  /** Si está cerrado: cuándo abre la próxima vez. */
  next: { day: DayKey; at: string; today: boolean; tomorrow: boolean } | null;
}

/** Día de la semana y minuto del día en la zona del punto. */
function localNow(now: Date, tz: string | null): { day: DayKey; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz ?? undefined,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
    return {
      day: dayAt(idx < 0 ? 0 : idx),
      minute: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
    };
  } catch {
    // Una zona que el navegador no conoce: la de quien mira. Mejor aproximado que nada.
    return { day: dayAt(now.getDay() - 1), minute: now.getHours() * 60 + now.getMinutes() };
  }
}

export function openState(h: WeeklyHours, now: Date = new Date()): OpenState {
  const { day, minute } = localNow(now, h.tz);
  const di = DAY_KEYS.indexOf(day);
  const prev = dayAt(di - 1);

  // Un turno de ayer que cruzó la medianoche y sigue abierto.
  for (const [from, to] of h.days[prev] ?? []) {
    const f = toMinutes(from);
    const t = toMinutes(to);
    if (t < f && minute < t) return { open: true, closesAt: to, next: null };
  }

  for (const [from, to] of h.days[day] ?? []) {
    const f = toMinutes(from);
    const t = toMinutes(to);
    const overnight = t < f;
    if (minute >= f && (overnight || minute < t)) {
      return { open: true, closesAt: to === "24:00" && isAllDay(h.days[day]) ? null : to, next: null };
    }
  }

  // Cerrado: el próximo turno, empezando por lo que queda de hoy.
  for (let offset = 0; offset < 8; offset++) {
    const d = dayAt(di + offset);
    for (const [from] of h.days[d] ?? []) {
      if (offset === 0 && toMinutes(from) <= minute) continue;
      return { open: false, closesAt: null, next: { day: d, at: from, today: offset === 0, tomorrow: offset === 1 } };
    }
  }
  return { open: false, closesAt: null, next: null };
}
