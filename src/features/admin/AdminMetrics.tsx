"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/context";
import { Icon } from "@/ui/icons";
import { Notice } from "@/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";
import { useSite } from "@/features/app/SiteProvider";
import { fetchAdminMetrics, type AdminMetrics as Metrics, type MetricsResult } from "@/data/adminMetrics";

/**
 * El tablero del equipo: la portada del panel.
 *
 * ── EL ORDEN ES LA PRIORIDAD ────────────────────────────────────────────────
 *
 * Primero lo que pide acción HOY —las colas y su plazo de 36 horas, que es la promesa del
 * roadmap— y después el pulso de la plataforma. Un tablero que empieza por «cuentas
 * totales» se lee como un trofeo; uno que empieza por «hay un aviso de hace 40 horas» se
 * lee como trabajo, que es para lo que se abre este panel.
 *
 * Todo sale de `admin_metrics()`, que cuenta en la base y no devuelve ninguna fila de
 * persona: el equipo sigue sin ver la experiencia ni los seguimientos de nadie.
 */

const SLA_H = 36;

function fmtH(h: number | null, t: ReturnType<typeof useI18n>["t"]): string {
  if (h === null) return "—";
  if (h < 1) return t("metrics.lessHour");
  if (h < 48) return t("metrics.hours", { n: Math.round(h) });
  return t("metrics.days", { n: Math.round(h / 24) });
}

function pct(part: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

function QueueTile({
  title,
  pending,
  oldest,
  median,
  within,
  done,
}: {
  title: string;
  pending: number;
  oldest: number | null;
  median: number | null;
  within: number;
  done: number;
}) {
  const { t } = useI18n();
  const late = oldest !== null && oldest > SLA_H;
  return (
    <div className={`mt-queue${late ? " mt-queue-late" : ""}`}>
      <div className="mt-queue-head">
        <span className="mt-queue-title">{title}</span>
        {/* El estado lleva palabra e icono, no sólo color. */}
        {pending === 0 ? (
          <span className="mt-pill mt-pill-ok">
            <Icon.check /> {t("metrics.clear")}
          </span>
        ) : late ? (
          <span className="mt-pill mt-pill-late">
            <Icon.alert /> {t("metrics.late")}
          </span>
        ) : (
          <span className="mt-pill">
            <Icon.clock /> {t("metrics.onTime")}
          </span>
        )}
      </div>
      <div className="mt-queue-nums">
        <span>
          <b>{pending}</b>
          {t("metrics.pending")}
        </span>
        <span>
          <b>{pending ? fmtH(oldest, t) : "—"}</b>
          {t("metrics.oldest")}
        </span>
        <span>
          <b>{pct(within, done)}</b>
          {t("metrics.within36")}
        </span>
      </div>
      <p className="mt-fine">
        {done > 0 ? // «la mitad en menos de {h}»: por debajo de una hora se dice «1 h», no «menos de
          // menos de 1 h».
          t("metrics.median", { h: fmtH(median === null ? null : Math.max(1, median), t), n: done }) : t("metrics.noneDone")}
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: "warn" }) {
  return (
    <div className="mt-kpi">
      <span className="mt-kpi-label">{label}</span>
      <span className="mt-kpi-value">{value}</span>
      {sub ? <span className={`mt-kpi-sub${tone === "warn" ? " mt-kpi-sub-warn" : ""}`}>{sub}</span> : null}
    </div>
  );
}

/** Acciones comprobadas por semana. Una serie: un tono, sin leyenda; el título la nombra. */
function WeeklyBars({ weekly }: { weekly: Metrics["weekly"] }) {
  const { t, lang } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weekly.map((w) => w.actions));
  const label = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(lang, { day: "numeric", month: "short" });
  const last = weekly.length - 1;

  return (
    <figure className="mt-chart">
      <figcaption className="mt-h">{t("metrics.weeklyTitle")}</figcaption>
      <div className="mt-bars" onMouseLeave={() => setHover(null)}>
        {weekly.map((w, i) => (
          <button
            key={w.week}
            type="button"
            className={`mt-bar${hover === i ? " mt-bar-on" : ""}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => setHover((h) => (h === i ? null : i))}
            aria-label={t("metrics.weekBar", { week: label(w.week), n: w.actions, a: w.accounts })}
          >
            <span className="mt-bar-fill" style={{ transform: `scaleY(${w.actions / max})` }} />
            {/* Etiqueta directa sólo en la última: la semana en curso es la que se mira. */}
            {i === last && hover === null ? <span className="mt-bar-val">{w.actions}</span> : null}
            {hover === i ? (
              <span className="mt-tip" role="status">
                <b>{label(w.week)}</b>
                <span>{t("metrics.tipActions", { n: w.actions })}</span>
                <span>{t("metrics.tipAccounts", { n: w.accounts })}</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-axis" aria-hidden="true">
        <span>{weekly[0] ? label(weekly[0].week) : ""}</span>
        <span>{t("metrics.thisWeek")}</span>
      </div>
      {/* La tabla para quien no ve el gráfico. */}
      <table className="vh">
        <caption>{t("metrics.weeklyTitle")}</caption>
        <thead>
          <tr>
            <th>{t("metrics.week")}</th>
            <th>{t("metrics.actions")}</th>
            <th>{t("metrics.newAccounts")}</th>
          </tr>
        </thead>
        <tbody>
          {weekly.map((w) => (
            <tr key={w.week}>
              <td>{label(w.week)}</td>
              <td>{w.actions}</td>
              <td>{w.accounts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function MetricsSkeleton() {
  return (
    <div className="mt" aria-hidden="true">
      <span className="skel mt-skel-queue" />
      <span className="skel mt-skel-queue" />
      <div className="mt-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="skel mt-skel-kpi" />
        ))}
      </div>
    </div>
  );
}

export default function AdminMetrics({ reloadKey }: { reloadKey: number }) {
  const { t } = useI18n();
  const site = useSite();
  const staleDays = site.map.staleAfterDays;
  const [res, setRes] = useState<MetricsResult | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    void fetchAdminMetrics(sb, staleDays).then((r) => {
      if (vivo) setRes(r);
    });
    return () => {
      vivo = false;
    };
  }, [staleDays, reloadKey]);

  if (!res) {
    return (
      <>
        <p className="vh" role="status">
          {t("common.loading")}
        </p>
        <MetricsSkeleton />
      </>
    );
  }
  if (!res.ok) {
    return <Notice tone="info">{t(res.reason === "missing" ? "metrics.missing" : "metrics.error")}</Notice>;
  }

  const m = res.data;
  const q = m.queues;
  const orgsSub = [
    m.orgs.expiring ? t("metrics.orgsExpiring", { n: m.orgs.expiring }) : null,
    m.orgs.expired ? t("metrics.orgsExpired", { n: m.orgs.expired }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mt" aria-label={t("metrics.title")}>
      <h3 className="mt-h">{t("metrics.queues")}</h3>
      <QueueTile
        title={t("metrics.reports")}
        pending={q.reports_pending}
        oldest={q.reports_oldest_h}
        median={q.reports_median_h}
        within={q.reports_within36}
        done={q.reports_done30}
      />
      <QueueTile
        title={t("metrics.subs")}
        pending={q.subs_pending + q.manage_pending}
        oldest={q.subs_oldest_h}
        median={q.subs_median_h}
        within={q.subs_within36}
        done={q.subs_done30}
      />

      <h3 className="mt-h">{t("metrics.map")}</h3>
      <div className="mt-grid">
        <Kpi
          label={t("metrics.points")}
          value={m.points.active}
          sub={t("metrics.pointsStale", { n: m.points.stale, d: staleDays })}
          tone={m.points.stale > 0 ? "warn" : undefined}
        />
        <Kpi
          label={t("metrics.orgsVerified")}
          value={`${m.orgs.verified}/${m.orgs.managed}`}
          sub={orgsSub || t("metrics.orgsAllGood")}
          tone={orgsSub ? "warn" : undefined}
        />
        <Kpi label={t("metrics.confirmed30")} value={m.points.confirmed30} />
        <Kpi label={t("metrics.campaigns")} value={m.activity.campaigns} sub={t("metrics.posts30", { n: m.activity.posts30 })} />
      </div>

      <h3 className="mt-h">{t("metrics.people")}</h3>
      <div className="mt-grid">
        <Kpi label={t("metrics.accounts")} value={m.people.accounts} sub={t("metrics.new30", { n: m.people.new30 })} />
        <Kpi label={t("metrics.active30")} value={m.people.active30} />
        <Kpi label={t("metrics.volunteers")} value={m.people.volunteers} />
        <Kpi label={t("metrics.follows")} value={m.people.follows} sub={t("metrics.new30", { n: m.people.follows30 })} />
        <Kpi label={t("metrics.events")} value={m.activity.events} sub={t("metrics.going", { n: m.activity.going })} />
        <Kpi label={t("metrics.attended30")} value={m.activity.attended30} />
        <Kpi label={t("metrics.checkins30")} value={m.activity.checkins30} />
        <Kpi label={t("metrics.donations30")} value={m.activity.donations30} />
      </div>

      {m.weekly.length > 0 ? <WeeklyBars weekly={m.weekly} /> : null}
    </section>
  );
}
