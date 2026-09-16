import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDisplayNames } from "@/data/account";

// Apuntarse a un evento (`activity_attendees`, db/13_eventos.sql).
//
// Como el resto de módulos de iniciativas, las lecturas no lanzan: una base sin la
// migración devuelve «nadie apuntado», que es exactamente como se ve un evento nuevo. Las
// escrituras sí lanzan, porque quien toca «Me apunto» tiene que enterarse si no quedó.

type Row = Record<string, unknown>;

/** Sin la tabla, no volver a preguntar en toda la pestaña. */
let tablaAusente = false;

function falta(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** Un evento al que esta persona se apuntó, con lo necesario para listarlo en su cuenta. */
export interface MyEvent {
  activityId: string;
  locationId: string;
  locationName: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  address: string | null;
}

/** Los ids de los eventos a los que ESTA persona se apuntó. */
export async function fetchMyAttendance(sb: SupabaseClient, userId: string): Promise<Set<string>> {
  if (tablaAusente) return new Set();
  const { data, error } = await sb.from("activity_attendees").select("activity_id").eq("user_id", userId);
  if (falta(error)) tablaAusente = true;
  if (error || !data) return new Set();
  return new Set((data as Row[]).map((r) => String(r.activity_id)));
}

/**
 * Su calendario: los eventos a los que se apuntó y que todavía no pasaron, el más próximo
 * primero. Un solo viaje: el evento y su punto vienen incrustados.
 */
export async function fetchMyEvents(sb: SupabaseClient, userId: string): Promise<MyEvent[]> {
  if (tablaAusente) return [];
  const { data, error } = await sb
    .from("activity_attendees")
    .select(
      "activity_id,activities(id,title,description,starts_at,ends_at,place,status,location_id,locations(name,address))",
    )
    .eq("user_id", userId);
  if (falta(error)) tablaAusente = true;
  if (error || !data) return [];

  const corte = Date.now() - 12 * 60 * 60 * 1000;
  const out: MyEvent[] = [];
  for (const row of data as Row[]) {
    const a = (Array.isArray(row.activities) ? row.activities[0] : row.activities) as Row | null;
    if (!a || a.status !== "scheduled") continue;
    const startsAt = String(a.starts_at ?? "");
    if (!startsAt || new Date(startsAt).getTime() < corte) continue;
    const l = (Array.isArray(a.locations) ? a.locations[0] : a.locations) as Row | null;
    out.push({
      activityId: String(a.id),
      locationId: String(a.location_id),
      locationName: typeof l?.name === "string" ? l.name : "",
      title: String(a.title ?? ""),
      description: typeof a.description === "string" ? a.description : null,
      startsAt,
      endsAt: typeof a.ends_at === "string" ? a.ends_at : null,
      place: typeof a.place === "string" ? a.place : null,
      address: typeof l?.address === "string" ? l.address : null,
    });
  }
  return out.sort((x, y) => x.startsAt.localeCompare(y.startsAt));
}

export async function joinActivity(sb: SupabaseClient, activityId: string, userId: string): Promise<void> {
  const { error } = await sb.from("activity_attendees").insert({ activity_id: activityId, user_id: userId });
  // Ya estaba apuntada: para quien toca el botón, el resultado es el que quería.
  if (error && error.code !== "23505") throw error;
}

export async function leaveActivity(sb: SupabaseClient, activityId: string, userId: string): Promise<void> {
  const { error } = await sb
    .from("activity_attendees")
    .delete()
    .eq("activity_id", activityId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Quién va, para la organización. Sólo el nombre para mostrar: el correo no está en
 * `profiles`, y la política `profiles_attendee_read` abre justo ese nombre y nada más.
 */
export async function fetchAttendeeNames(sb: SupabaseClient, activityId: string): Promise<string[]> {
  if (tablaAusente) return [];
  const { data, error } = await sb
    .from("activity_attendees")
    .select("user_id,created_at")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });
  if (falta(error)) tablaAusente = true;
  if (error || !data) return [];
  const ids = (data as Row[]).map((r) => String(r.user_id));
  const names = await fetchDisplayNames(sb, ids);
  return ids.map((id) => names.get(id) ?? "");
}
