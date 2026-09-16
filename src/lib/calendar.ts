/**
 * Llevar un evento al calendario de la persona.
 *
 * ── POR QUÉ ASÍ Y NO CON NOTIFICACIONES PROPIAS ────────────────────────────
 *
 * El recordatorio que de verdad llega es el del calendario del teléfono: suena aunque la
 * app esté cerrada, sin permisos de notificaciones, sin cuenta en ningún servicio nuestro y
 * sin un servidor que tenga que acordarse de mandar nada. Es lo que ya usa la gente para
 * no olvidarse de una cita.
 *
 * Dos caminos, porque no hay uno que valga para todos:
 *
 *   · Google Calendar, con un enlace que abre el evento ya rellenado. Sin OAuth: no se pide
 *     acceso al calendario de nadie, la persona confirma en la pantalla de Google.
 *   · Un archivo `.ics`, que abren el calendario de iPhone, Outlook y casi cualquier otro.
 *     Lleva dos avisos: el día antes y dos horas antes.
 *
 * Todo se arma en el navegador. La hora va en UTC (`…Z`), así que cada calendario la pinta
 * en la zona de quien la mira sin que haya que adivinar ninguna.
 */

export interface CalendarEvent {
  /** Estable por evento: un segundo `.ics` del mismo evento lo actualiza en vez de duplicarlo. */
  uid: string;
  title: string;
  description: string | null;
  /** ISO. */
  startsAt: string;
  /** ISO. Null = dura dos horas, que es lo que dura una jornada típica. */
  endsAt: string | null;
  location: string | null;
  /** La ficha del punto, para volver a ella desde el calendario. */
  url: string | null;
}

const DURACION_MS = 2 * 60 * 60 * 1000;

function fin(ev: CalendarEvent): Date {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : null;
  return end && end > start ? end : new Date(start.getTime() + DURACION_MS);
}

/** 2026-09-19T14:00:00.000Z → 20260919T140000Z */
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const details = [ev.description, ev.url].filter(Boolean).join("\n\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${stamp(new Date(ev.startsAt))}/${stamp(fin(ev))}`,
    details,
    location: ev.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** RFC 5545: comas, punto y coma y barras se escapan; los saltos de línea son `\n`. */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Líneas de más de 75 octetos se parten: algunos calendarios rechazan el archivo si no. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export function icsText(ev: CalendarEvent, productName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${esc(productName)}//Eventos//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(new Date(ev.startsAt))}`,
    `DTEND:${stamp(fin(ev))}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.description ? `DESCRIPTION:${esc([ev.description, ev.url].filter(Boolean).join("\n\n"))}` : null,
    ev.location ? `LOCATION:${esc(ev.location)}` : null,
    ev.url ? `URL:${ev.url}` : null,
    // Dos avisos: el día antes para organizarse y dos horas antes para salir.
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Descarga el `.ics`. En un teléfono, abrirlo lo manda directo a su calendario. */
export function downloadIcs(ev: CalendarEvent, productName: string): void {
  const blob = new Blob([icsText(ev, productName)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "evento"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
