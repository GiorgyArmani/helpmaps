import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMySubmissions, fetchMyVolunteerRequest } from "@/data/account";
import { fetchMyBadges, fetchMyContributions } from "@/data/recognition";
import { EMPTY_SOURCES, NOTIF_WINDOW_DAYS, type NotifSources } from "@/domain/notifications";

// El material de las notificaciones. Ver `src/domain/notifications.ts` para por qué se
// calculan con lo que la persona ya puede leer en vez de guardarse en una tabla.
//
// Como el resto de lecturas de iniciativas, ninguna lanza: una base sin la migración de
// campañas devuelve «nada nuevo», que es justo como se ve una cuenta recién creada.

type Row = Record<string, unknown>;

const text = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Lo que publicaron los puntos que ESTA persona guardó, en el último mes.
 *
 * Los ids viajan en el filtro, y eso no le cuenta al servidor nada que no sepa: los
 * guardados ya viven ahí, bajo una política que sólo deja leerlos a su dueño. Lo que no
 * hace nadie es cruzarlos con otra persona.
 *
 * Tres consultas cortas y acotadas por fecha, en vez de reusar las del feed: aquéllas traen
 * lo reciente de TODO el despliegue para ordenarlo por cercanía, y aquí sólo hace falta lo
 * de dos o tres puntos.
 */
async function fetchSavedActivity(
  sb: SupabaseClient,
  ids: string[],
): Promise<Pick<NotifSources, "posts" | "campaigns" | "events">> {
  if (ids.length === 0) return { posts: [], campaigns: [], events: [] };
  const since = new Date(Date.now() - NOTIF_WINDOW_DAYS * 86_400_000).toISOString();

  const [posts, campaigns, events] = await Promise.all([
    sb
      .from("initiative_posts")
      .select("id,location_id,body,created_at")
      .in("location_id", ids)
      .eq("status", "published")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
    sb
      .from("campaigns")
      .select("id,location_id,title,status,starts_on,updated_at")
      .in("location_id", ids)
      .in("status", ["active", "reached"])
      .order("starts_on", { ascending: false })
      .limit(40),
    sb
      .from("activities")
      .select("id,location_id,title,starts_at,created_at")
      .in("location_id", ids)
      .eq("status", "scheduled")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const rows = (r: { data: unknown; error: unknown }): Row[] => (r.error || !r.data ? [] : (r.data as Row[]));
  return {
    posts: rows(posts).map((r) => ({
      id: text(r.id),
      location_id: text(r.location_id),
      body: text(r.body),
      created_at: text(r.created_at),
    })),
    campaigns: rows(campaigns).map((r) => ({
      id: text(r.id),
      location_id: text(r.location_id),
      title: text(r.title),
      status: text(r.status),
      starts_on: text(r.starts_on),
      updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
    })),
    events: rows(events).map((r) => ({
      id: text(r.id),
      location_id: text(r.location_id),
      title: text(r.title),
      starts_at: text(r.starts_at),
      created_at: text(r.created_at),
    })),
  };
}

/** Todo lo que hace falta para armar la bandeja, en una sola tanda de peticiones. */
export async function fetchNotificationSources(sb: SupabaseClient, savedIds: string[]): Promise<NotifSources> {
  try {
    const [contributions, badges, submissions, volunteer, saved] = await Promise.all([
      fetchMyContributions(sb),
      fetchMyBadges(sb),
      fetchMySubmissions(sb),
      fetchMyVolunteerRequest(sb),
      fetchSavedActivity(sb, savedIds),
    ]);
    return { contributions, badges, submissions, volunteer, ...saved };
  } catch {
    // Sin red: la bandeja queda vacía, no rota.
    return EMPTY_SOURCES;
  }
}
