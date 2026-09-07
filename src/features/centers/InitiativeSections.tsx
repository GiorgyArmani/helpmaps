"use client";

import { useState } from "react";
import type { Activity, Campaign, InitiativePost } from "@/domain/types";
import type { InitiativeProfile } from "@/data/initiatives";
import { Icon } from "@/ui/icons";
import { useI18n, useTimeAgo } from "@/i18n/context";
import { BRAND } from "@/config";

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
export default function InitiativeSections({ profile }: { profile: InitiativeProfile }) {
  const { campaigns, activities, posts, donate } = profile;
  const hayDonacion = Boolean(donate.info || donate.url);
  if (campaigns.length === 0 && activities.length === 0 && posts.length === 0 && !hayDonacion) {
    return null;
  }

  return (
    <>
      {campaigns.length > 0 ? <CampaignList campaigns={campaigns} /> : null}
      {/* Debajo de las campañas: quien acaba de leer una meta concreta es justo quien
          quiere saber por dónde aportar. */}
      {hayDonacion ? <DonateBox donate={donate} /> : null}
      {activities.length > 0 ? <ActivityList activities={activities} /> : null}
      {posts.length > 0 ? <PostList posts={posts} campaigns={campaigns} /> : null}
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
function DonateBox({ donate }: { donate: InitiativeProfile["donate"] }) {
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
      {donate.url ? (
        <a className="btnp" href={donate.url} target="_blank" rel="noopener noreferrer">
          {t("donate.button")}
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

function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const { t } = useI18n();
  return (
    <section className="isec">
      <h3 className="dsection">{t("campaign.title")}</h3>
      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} />
      ))}
    </section>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
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
    <article className="icamp">
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

function ActivityList({ activities }: { activities: Activity[] }) {
  const { t, lang } = useI18n();
  return (
    <section className="isec">
      <h3 className="dsection">{t("activity.title")}</h3>
      {activities.map((a) => (
        <article key={a.id} className="iact">
          <span className="iact-when">
            <b>{formatDayNumber(a.starts_at, lang)}</b>
            <span>{formatMonthShort(a.starts_at, lang)}</span>
          </span>
          <span className="iact-body">
            <span className="iact-t">{a.title}</span>
            <span className="iact-meta">
              {formatTime(a.starts_at, lang)}
              {a.place ? ` · ${a.place}` : ""}
            </span>
            {a.description ? <span className="iact-d">{a.description}</span> : null}
            {a.needs_volunteers ? (
              <span className="iact-vol">
                <Icon.volunteer />
                {t("activity.needsVolunteers")}
              </span>
            ) : null}
          </span>
        </article>
      ))}
    </section>
  );
}

// ── Lo que ya hizo ─────────────────────────────────────────────────────────

function PostList({ posts, campaigns }: { posts: InitiativePost[]; campaigns: Campaign[] }) {
  const { t } = useI18n();
  const ago = useTimeAgo();
  return (
    <section className="isec">
      <h3 className="dsection">{t("post.title")}</h3>
      {posts.map((p) => {
        // El título de la campaña a la que rinde cuentas, si sigue viva. Si se cerró, la
        // entrada se queda igual: lo que se entregó siguió pasando aunque la meta ya no
        // esté en la lista de campañas vivas.
        const deCampana = p.campaign_id
          ? campaigns.find((c) => c.id === p.campaign_id)?.title
          : undefined;
        return (
          <article key={p.id} className="ipost">
            {p.photo_url ? (
              // Sin `next/image`: la URL viene de un bucket que cada país configura por su
              // cuenta, y un dominio no declarado en `next.config.ts` haría fallar el
              // render entero de la ficha en vez de dejar una foto rota.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="ipost-img" src={p.photo_url} alt="" loading="lazy" />
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
 */
function formatAmount(value: number, lang: string): string {
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
