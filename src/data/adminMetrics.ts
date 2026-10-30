import type { SupabaseClient } from "@supabase/supabase-js";

// El tablero del admin y la re-verificación (`db/19_seguir_y_verificada.sql`).
//
// `admin_metrics()` devuelve sólo conteos —ninguna fila de persona— y la decide la base:
// quien no es del equipo recibe «not_allowed». Aquí sólo se le da forma.

export interface AdminMetrics {
  points: { active: number; stale: number; confirmed30: number };
  orgs: { managed: number; verified: number; expiring: number; expired: number };
  people: {
    accounts: number;
    new30: number;
    volunteers: number;
    active30: number;
    follows: number;
    follows30: number;
  };
  activity: {
    campaigns: number;
    posts30: number;
    events: number;
    going: number;
    attended30: number;
    donations30: number;
    checkins30: number;
  };
  queues: {
    reports_pending: number;
    reports_oldest_h: number | null;
    reports_median_h: number | null;
    reports_within36: number;
    reports_done30: number;
    subs_pending: number;
    subs_oldest_h: number | null;
    subs_median_h: number | null;
    subs_within36: number;
    subs_done30: number;
    manage_pending: number;
  };
  weekly: { week: string; accounts: number; actions: number }[];
}

/** «missing» = la base no tiene la migración 19; «error» = otra cosa (red, permisos). */
export type MetricsResult = { ok: true; data: AdminMetrics } | { ok: false; reason: "missing" | "error" };

const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : 0;
};
const nOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : n(v));

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

function shape(raw: unknown): AdminMetrics {
  const r = obj(raw);
  const p = obj(r.points);
  const o = obj(r.orgs);
  const pe = obj(r.people);
  const a = obj(r.activity);
  const q = obj(r.queues);
  return {
    points: { active: n(p.active), stale: n(p.stale), confirmed30: n(p.confirmed30) },
    orgs: { managed: n(o.managed), verified: n(o.verified), expiring: n(o.expiring), expired: n(o.expired) },
    people: {
      accounts: n(pe.accounts),
      new30: n(pe.new30),
      volunteers: n(pe.volunteers),
      active30: n(pe.active30),
      follows: n(pe.follows),
      follows30: n(pe.follows30),
    },
    activity: {
      campaigns: n(a.campaigns),
      posts30: n(a.posts30),
      events: n(a.events),
      going: n(a.going),
      attended30: n(a.attended30),
      donations30: n(a.donations30),
      checkins30: n(a.checkins30),
    },
    queues: {
      reports_pending: n(q.reports_pending),
      reports_oldest_h: nOrNull(q.reports_oldest_h),
      reports_median_h: nOrNull(q.reports_median_h),
      reports_within36: n(q.reports_within36),
      reports_done30: n(q.reports_done30),
      subs_pending: n(q.subs_pending),
      subs_oldest_h: nOrNull(q.subs_oldest_h),
      subs_median_h: nOrNull(q.subs_median_h),
      subs_within36: n(q.subs_within36),
      subs_done30: n(q.subs_done30),
      manage_pending: n(q.manage_pending),
    },
    weekly: Array.isArray(r.weekly)
      ? (r.weekly as unknown[]).map((w) => {
          const x = obj(w);
          return { week: String(x.week ?? ""), accounts: n(x.accounts), actions: n(x.actions) };
        })
      : [],
  };
}

/** `PGRST202`: PostgREST no encuentra la función — la migración no está corrida. */
function missingFn(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export async function fetchAdminMetrics(sb: SupabaseClient, staleDays: number): Promise<MetricsResult> {
  const { data, error } = await sb.rpc("admin_metrics", { p_stale_days: staleDays });
  if (error) return { ok: false, reason: missingFn(error) ? "missing" : "error" };
  return { ok: true, data: shape(data) };
}

/**
 * «Verificado hoy»: sella el dato del punto y, si tiene gestor, renueva el sello de la
 * organización. Devuelve la fecha que quedó, o lanza.
 */
export async function reverifyLocation(sb: SupabaseClient, locationId: string): Promise<string> {
  const { data, error } = await sb.rpc("reverify_location", { p_location: locationId });
  if (error) throw Object.assign(new Error(error.message), { code: error.code, missing: missingFn(error) });
  return typeof data === "string" ? data : new Date().toISOString();
}
