"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Activity, Campaign, InitiativePost } from "@/domain/types";
import type { InitiativeProfile } from "@/data/initiatives";
import { Icon } from "@/ui/icons";
import { getSupabase } from "@/lib/supabase/client";
import { useAccount } from "@/features/account/useAccount";
import { useI18n, useTimeAgo } from "@/i18n/context";
import { BRAND } from "@/config";
import { fetchMyAttendance, joinActivity, leaveActivity } from "@/data/events";
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";

const noSubscribe = () => () => {};

/**
 * Lo que una iniciativa cuenta de sí misma dentro de su ficha: lo que está recaudando, lo
 * que va a hacer y lo que ya hizo.
 *
 * DÓNDE VA, Y POR QUÉ AHÍ. Debajo de los botones de llamar y cómo llegar, no encima. El
 * orden de la ficha está pensado para alguien que necesita algo y lee con el 4% de
 * batería: nombre, si el dato es fresco, el aviso, qué necesita, cómo llegar. Una campaña
 * de recaudación se dirige a otra persona —la que quiere ayudar— y esa persona tiene
 * tiempo de bajar. Meterla arriba le quita el sitio a lo urgente para servir a lo
 * importante, que es el intercambio equivocado en un mapa de emergencia.
 *
 * Si no hay nada que contar, no se dibuja nada: ni encabezados vacíos ni «esta iniciativa
 * todavía no ha publicado». Un hueco con forma de ausencia se lee como abandono, y el
 * 90% de los puntos de este mapa no van a tener campaña nunca.
 */
/**
 * Las cuatro secciones seguidas, para quien las quiera en un solo rollo.
 *
 * La ficha dentro del mapa ya NO usa esto: las reparte en pestañas (ver `ProfileTabs`).
 * Se mantiene porque cada sección se exporta suelta y este envoltorio sigue siendo la
 * forma correcta de pintarlas todas donde no hay pestañas —una impresión, un correo, la
 * página servida sin JavaScript— y porque borrarlo obligaría a reescribir el orden en el
 * que van, que está pensado: la campaña primero y el «cómo aportar» justo debajo.
 */
export default function InitiativeSections({ profile }: { profile: InitiativeProfile }) {
  const { campaigns, activities, posts, donate } = profile;
  const hayDonacion = Boolean(donate.info || donate.url);
  if (campaigns.length === 0 && activities.length === 0 && posts.length === 0 && !hayDonacion) {
    return null;
  }

  return (
    <>
      {campaigns.length > 0 ? <CampaignList campaigns={campaigns} titled /> : null}
      {/* Debajo de las campañas: quien acaba de leer una meta concreta es justo quien
          quiere saber por dónde aportar. */}
      {hayDonacion ? <DonateBox donate={donate} /> : null}
      {activities.length > 0 ? <ActivityList activities={activities} titled /> : null}
      {posts.length > 0 ? <PostList posts={posts} campaigns={campaigns} titled /> : null}
    </>
  );
}

/**
 * Por dónde recibe esta iniciativa.
 *
 * Botón de copiar y no un formulario de pago: la plataforma NO se pone en medio. Estos
 * datos son de la iniciativa, el dinero va directo a ella, y aquí sólo se muestran para
 * que se puedan pegar en el banco. La línea que lo dice va debajo y no es opcional.
 */
export function DonateBox({ donate }: { donate: InitiativeProfile["donate"] }) {
  const { t } = useI18n();
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!donate.info) return;
    try {
      await navigator.clipboard.writeText(donate.info);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles el texto sigue a la vista y se puede seleccionar a
      // mano. Un error aquí no aporta nada que la persona pueda hacer.
    }
  }

  return (
    <section className="isec">
      <h3 className="dsection">{t("donate.direct")}</h3>
      {donate.info ? (
        <div className="idon">
          <p className="idon-info">{donate.info}</p>
          <button type="button" className="btng" onClick={() => void copiar()}>
            <Icon.link />
            {copiado ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      ) : null}
      {/* UN botón y fuerte: es la acción de toda la sección.
          «Ya aporté» ESTÁ APAGADO, no borrado. Declarar un aporte deja una fila pendiente
          que la iniciativa tiene que confirmar a mano (`db/07_aportes.sql`), y en esta
          primera versión eso era una cola de trabajo para organizaciones que todavía no
          están mirando el panel. Darlo por bueno sin confirmar tampoco vale: serían quince
          puntos de experiencia por pulsar un botón. Así que por ahora donar no suma nivel;
          la tabla, las políticas y la recompensa siguen en la base para cuando vuelva. */}
      {donate.url ? (
        <a className="idon-cta" href={donate.url} target="_blank" rel="noopener noreferrer">
          <span className="idon-cta-ic" aria-hidden="true">
            <Icon.heart />
          </span>
          <span className="idon-cta-txt">
            <b>{t("donate.go")}</b>
            <small>{t("donate.goHint")}</small>
          </span>
        </a>
      ) : null}

      <p className="idon-note">
        <Icon.alert />
        {t("donate.directNote", { platform: BRAND.platform })}
      </p>
    </section>
  );
}

// ── Campañas ───────────────────────────────────────────────────────────────

/**
 * `titled` sólo donde las secciones van seguidas. Dentro de una pestaña el título repetía
 * el nombre de la pestaña que se acaba de tocar —«Novedades» y debajo «Lo que ya hizo»—, y
 * era una línea menos de contenido en la pantalla de un teléfono.
 */
export function CampaignList({ campaigns, titled = false }: { campaigns: Campaign[]; titled?: boolean }) {
  const { t } = useI18n();
  return (
    <section className="isec">
      {titled ? <h3 className="dsection">{t("campaign.title")}</h3> : null}
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} />
      ))}
    </section>
  );
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t, lang } = useI18n();
  const ago = useTimeAgo();

  // Acotado a 100 aunque lo declarado supere la meta: una barra que se sale de su caja se
  // ve como un fallo de la app y no como una campaña que se pasó de lo que pedía. El
  // número de al lado sí dice la cifra real.
  const pct = campaign.goal_amount > 0
    ? Math.min(100, Math.round((campaign.raised_amount / campaign.goal_amount) * 100))
    : 0;
  const alcanzada = campaign.status === "reached" || campaign.raised_amount >= campaign.goal_amount;

  return (
    <article className={`icamp${campaign.image_url ? " icamp-withimg" : ""}`}>
      {campaign.image_url ? (
        // Sin `next/image`: el bucket es de cada país. La proporción reserva el hueco antes
        // de que llegue la imagen, para que el texto de abajo no salte al cargar.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="icamp-img" src={campaign.image_url} alt="" loading="lazy" decoding="async" />
      ) : null}
      <div className="icamp-head">
        <h4 className="icamp-t">{campaign.title}</h4>
        {alcanzada ? <span className="icamp-done">{t("campaign.reached")}</span> : null}
      </div>

      <p className="icamp-p">{campaign.purpose}</p>

      <div
        className="icamp-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={campaign.title}
      >
        <span className={`icamp-fill${alcanzada ? " icamp-fill-done" : ""}`} style={{ width: `${pct}%` }} />
      </div>

      <p className="icamp-n">
        <b>{formatAmount(campaign.raised_amount, lang)}</b>
        {" "}
        {t("campaign.of", {
          goal: formatAmount(campaign.goal_amount, lang),
          unit: campaign.goal_unit,
        })}
      </p>

      {/* LA LÍNEA QUE NO SE PUEDE QUITAR.
          {platform} no cobra ni custodia: esa cifra la declara la propia iniciativa y
          nadie la ha verificado. Una barra de progreso sin esto se lee como un saldo
          auditado, que es justo la promesa que este proyecto dice no hacer. Si algún día
          hay dinero que sí pase por la plataforma, será otra cifra y con otro aspecto. */}
      <p className="icamp-src">
        <Icon.alert />
        {campaign.raised_declared_at
          ? t("campaign.declaredAgo", { ago: ago(campaign.raised_declared_at) })
          : t("campaign.declared")}
      </p>

      {campaign.ends_on ? (
        <p className="icamp-until">
          <Icon.clock />
          {t("campaign.until", { date: formatDate(campaign.ends_on, lang) })}
        </p>
      ) : null}
    </article>
  );
}

// ── Agenda ─────────────────────────────────────────────────────────────────

export function ActivityList({
  activities,
  titled = false,
  where = null,
  extra,
}: {
  activities: Activity[];
  titled?: boolean;
  /** Dónde es, cuando el evento no dice otro sitio: la dirección de la sede. */
  where?: string | null;
  /**
   * Lo que ve la organización bajo cada evento suyo (quién va). Con esto no se ofrece
   * «Me apunto»: apuntarse a tu propio evento no le dice nada a nadie.
   */
  extra?: (activity: Activity) => React.ReactNode;
}) {
  const { t, lang } = useI18n();
  const account = useAccount(true);
  const [mine, setMine] = useState<Set<string>>(() => new Set());

  // La fecha y la hora, sólo en el navegador. El servidor formatea en SU zona horaria —UTC
  // en producción—, así que la página pública llegaba diciendo «2:00 p. m.» para un evento
  // de las 10:00 hasta que hidrataba, y encima la diferencia rompía la hidratación. El
  // hueco se reserva con un espacio para que nada salte al aparecer.
  const enCliente = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

  // A qué se apuntó ya esta persona. Una consulta por lista, no una por evento.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !account.userId) return;
    let vivo = true;
    void fetchMyAttendance(sb, account.userId).then((ids) => {
      if (vivo) setMine(ids);
    });
    return () => {
      vivo = false;
    };
  }, [account.userId]);

  return (
    <section className="isec">
      {titled ? <h3 className="dsection">{t("activity.title")}</h3> : null}
      {activities.map((a) => (
        <article key={a.id} className="iact">
          <span className="iact-when">
            <b>{enCliente ? formatDayNumber(a.starts_at, lang) : " "}</b>
            <span>{enCliente ? formatMonthShort(a.starts_at, lang) : " "}</span>
          </span>
          <span className="iact-body">
            <span className="iact-t">{a.title}</span>
            <span className="iact-meta">
              {enCliente ? formatTime(a.starts_at, lang) : " "}
              {a.place ? ` · ${a.place}` : ""}
            </span>
            {a.description ? <span className="iact-d">{a.description}</span> : null}
            {a.needs_volunteers ? (
              <span className="iact-vol">
                <Icon.volunteer />
                {t("activity.needsVolunteers")}
              </span>
            ) : null}
            {extra ? extra(a) : null}
            <EventActions
              activity={a}
              canJoin={!extra}
              where={where}
              userId={account.userId}
              checked={account.checked}
              going={mine.has(a.id)}
              onChange={(on) =>
                setMine((prev) => {
                  const next = new Set(prev);
                  if (on) next.add(a.id);
                  else next.delete(a.id);
                  return next;
                })
              }
            />
          </span>
        </article>
      ))}
    </section>
  );
}

/** Un evento, tal como lo lleva un calendario. */
export function toCalendarEvent(a: Activity, where: string | null): CalendarEvent {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return {
    uid: `${a.id}@helpmaps`,
    title: a.title,
    description: a.description,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    location: a.place ?? where,
    url: origin ? `${origin}/c/${a.location_id}?tab=agenda` : null,
  };
}

/**
 * «Me apunto» y llevarlo al calendario.
 *
 * Apuntarse es declarado: le dice a la organización cuánta gente espera y deja el evento en
 * «Mis eventos». NO suma experiencia; eso lo hará el QR de reconocimiento, cuando la
 * organización confirme que la persona vino.
 *
 * Al apuntarse se abren solas las opciones de calendario: es el momento en que la intención
 * está fresca, y el recordatorio del teléfono es lo que hace que de verdad vaya.
 */
function EventActions({
  activity,
  canJoin,
  where,
  userId,
  checked,
  going,
  onChange,
}: {
  activity: Activity;
  canJoin: boolean;
  where: string | null;
  userId: string | null;
  checked: boolean;
  going: boolean;
  onChange: (going: boolean) => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [cal, setCal] = useState(false);
  // El contador se mueve con el toque, sin esperar a recargar el evento.
  const [delta, setDelta] = useState(0);
  const count = Math.max(0, activity.going_count + delta);

  async function toggle() {
    const sb = getSupabase();
    if (!sb || !userId || busy) return;
    setBusy(true);
    setFallo(false);
    const next = !going;
    try {
      if (next) await joinActivity(sb, activity.id, userId);
      else await leaveActivity(sb, activity.id, userId);
      onChange(next);
      setDelta((d) => d + (next ? 1 : -1));
      setCal(next);
    } catch {
      setFallo(true);
    } finally {
      setBusy(false);
    }
  }

  const ev = toCalendarEvent(activity, where);

  return (
    <span className="iact-acts">
      <span className="iact-row">
        {!canJoin || !checked ? null : userId ? (
          <button
            type="button"
            className={`iact-join${going ? " iact-join-on" : ""}`}
            aria-pressed={going}
            disabled={busy}
            onClick={() => void toggle()}
          >
            {going ? <Icon.check /> : <Icon.plus />}
            {going ? t("event.going") : t("event.join")}
          </button>
        ) : (
          <a className="iact-join" href="/login">
            <Icon.user />
            {t("event.signInToJoin")}
          </a>
        )}
        <button
          type="button"
          className={`iact-cal${cal ? " iact-cal-on" : ""}`}
          aria-expanded={cal}
          onClick={() => setCal((v) => !v)}
        >
          <Icon.clock />
          {t("event.addToCalendar")}
        </button>
      </span>

      {canJoin && count > 0 ? (
        <span className="iact-count">{t(count === 1 ? "event.goingOne" : "event.goingN", { n: count })}</span>
      ) : null}
      {fallo ? <span className="lerr">{t("error.generic")}</span> : null}

      {cal ? <CalendarChoices event={ev} hint={going} /> : null}
    </span>
  );
}

/** Google Calendar o un `.ics`. Se reusa donde se crea un evento y en «Mis eventos». */
export function CalendarChoices({ event, hint = false }: { event: CalendarEvent; hint?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="iact-calmenu">
      {hint ? <span className="iact-calhint">{t("event.calHint")}</span> : null}
      <a className="btng" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
        {t("event.google")}
      </a>
      <button type="button" className="btng" onClick={() => downloadIcs(event, BRAND.platform)}>
        {t("event.ics")}
      </button>
    </span>
  );
}

// ── Lo que ya hizo ─────────────────────────────────────────────────────────

export function PostList({
  posts,
  campaigns,
  titled = false,
}: {
  posts: InitiativePost[];
  campaigns: Campaign[];
  titled?: boolean;
}) {
  const { t } = useI18n();
  const ago = useTimeAgo();
  return (
    <section className="isec">
      {titled ? <h3 className="dsection">{t("post.title")}</h3> : null}
      {posts.map((p) => {
        // El título de la campaña a la que rinde cuentas, si sigue viva. Si se cerró, la
        // entrada se queda igual: lo que se entregó siguió pasando aunque la meta ya no
        // esté en la lista de campañas vivas.
        const deCampana = p.campaign_id
          ? campaigns.find((c) => c.id === p.campaign_id)?.title
          : undefined;
        return (
          // El `id` es lo que convierte una publicación en algo enlazable: el feed manda
          // a `/c/<punto>#p-<publicación>` y el navegador la deja en pantalla él solo.
          // Resaltarla es cosa del CSS con `:target` — sin JavaScript, sin estado y sin
          // que haya que saber cuál era desde el servidor.
          <article key={p.id} id={`p-${p.id}`} className="ipost">
            {p.photo_url ? (
              // Sin `next/image`: la URL viene de un bucket que cada país configura por su
              // cuenta, y un dominio no declarado en `next.config.ts` haría fallar el
              // render entero de la ficha en vez de dejar una foto rota.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ipost-img" src={p.photo_url} alt="" loading="lazy" decoding="async" />
            ) : null}
            <p className="ipost-meta">
              <span className={`ipost-kind ipost-${p.kind}`}>{t(kindKey(p.kind))}</span>
              <span className="ipost-ago">{ago(p.created_at)}</span>
            </p>
            <p className="ipost-body">{p.body}</p>
            {deCampana ? (
              <p className="ipost-camp">{t("post.fromCampaign", { name: deCampana })}</p>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function kindKey(kind: InitiativePost["kind"]) {
  return kind === "entrega"
    ? ("post.kind.entrega" as const)
    : kind === "necesidad"
      ? ("post.kind.necesidad" as const)
      : ("post.kind.avance" as const);
}

// ── Formato ────────────────────────────────────────────────────────────────

/**
 * Sin decimales cuando no los hay: «120 colchonetas», no «120,00 colchonetas». La unidad
 * la pone la iniciativa y la mitad de las veces no es dinero.
 *
 * Se exporta porque el feed pinta la misma cifra: dos formatos distintos para el mismo
 * número —«78» aquí y «78,00» allí— se leen como dos datos distintos.
 */
export function formatAmount(value: number, lang: string): string {
  const entero = Number.isInteger(value);
  return new Intl.NumberFormat(locale(lang), {
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function locale(lang: string): string {
  return lang === "en" ? "en-US" : lang === "pt" ? "pt-BR" : "es-VE";
}

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "long" }).format(d);
}

function formatDayNumber(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale(lang), { day: "numeric" }).format(d);
}

function formatMonthShort(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale(lang), { month: "short" }).format(d).replace(".", "");
}

function formatTime(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale(lang), { hour: "numeric", minute: "2-digit" }).format(d);
}
