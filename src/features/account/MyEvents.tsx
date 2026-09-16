"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyEvents, leaveActivity, type MyEvent } from "@/data/events";
import { CalendarChoices } from "@/features/centers/InitiativeSections";
import type { CalendarEvent } from "@/lib/calendar";
import { localeFor } from "@/domain/hours";

/**
 * «Mis eventos»: el calendario de esta persona dentro de la app.
 *
 * Lo próximo arriba, y lo de HOY y MAÑANA marcado: es la pregunta con la que se abre esta
 * pantalla —«¿tenía algo esta semana?»— y la respuesta tiene que verse sin leer fechas.
 * Cada evento se puede llevar al calendario del teléfono, que es el que avisa de verdad.
 */
export default function MyEvents({
  userId,
  onOpenCenter,
}: {
  userId: string;
  onOpenCenter: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const [events, setEvents] = useState<MyEvent[] | null>(null);
  const [cal, setCal] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void fetchMyEvents(sb, userId).then((e) => {
      if (vivo) setEvents(e);
    });
    return () => {
      vivo = false;
    };
  }, [userId]);

  async function dejar(ev: MyEvent) {
    const sb = getSupabase();
    if (!sb) return;
    const antes = events;
    // Optimista: la fila se va ya; si falla, vuelve.
    setEvents((prev) => prev?.filter((x) => x.activityId !== ev.activityId) ?? null);
    try {
      await leaveActivity(sb, ev.activityId, userId);
    } catch {
      setEvents(antes);
    }
  }

  const loc = localeFor(lang);
  const hoy = new Date();
  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const manana = new Date(hoy.getTime() + 86400000);

  return (
    <section className="acc-sec">
      <h3 className="acc-h">{t("myEvents.title")}</h3>
      {events === null ? (
        <span className="skel acc-skel" aria-hidden="true" />
      ) : events.length === 0 ? (
        <p className="acc-empty">{t("myEvents.none")}</p>
      ) : (
        <ul className="myev">
          {events.map((ev) => {
            const d = new Date(ev.startsAt);
            const cuando = mismoDia(d, hoy) ? t("myEvents.today") : mismoDia(d, manana) ? t("myEvents.tomorrow") : null;
            const calEvent: CalendarEvent = {
              uid: `${ev.activityId}@helpmaps`,
              title: ev.title,
              description: ev.description,
              startsAt: ev.startsAt,
              endsAt: ev.endsAt,
              location: ev.place ?? ev.address,
              url: `${window.location.origin}/c/${ev.locationId}?tab=agenda`,
            };
            return (
              <li key={ev.activityId} className={`myev-item${cuando ? " myev-soon" : ""}`}>
                <span className="iact-when">
                  <b>{new Intl.DateTimeFormat(loc, { day: "numeric" }).format(d)}</b>
                  <span>{new Intl.DateTimeFormat(loc, { month: "short" }).format(d).replace(".", "")}</span>
                </span>
                <span className="myev-body">
                  {cuando ? <span className="myev-badge">{cuando}</span> : null}
                  <span className="iact-t">{ev.title}</span>
                  <span className="iact-meta">
                    {new Intl.DateTimeFormat(loc, { weekday: "long", hour: "numeric", minute: "2-digit" }).format(d)}
                    {ev.place ? ` · ${ev.place}` : ""}
                  </span>
                  <button type="button" className="myev-org" onClick={() => onOpenCenter(ev.locationId)}>
                    {ev.locationName}
                    <Icon.chevron />
                  </button>
                  <span className="iact-row">
                    <button
                      type="button"
                      className={`iact-cal${cal === ev.activityId ? " iact-cal-on" : ""}`}
                      aria-expanded={cal === ev.activityId}
                      onClick={() => setCal((c) => (c === ev.activityId ? null : ev.activityId))}
                    >
                      <Icon.clock />
                      {t("event.addToCalendar")}
                    </button>
                    <button type="button" className="iact-join" onClick={() => void dejar(ev)}>
                      <Icon.close />
                      {t("myEvents.leave")}
                    </button>
                  </span>
                  {cal === ev.activityId ? <CalendarChoices event={calEvent} /> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
