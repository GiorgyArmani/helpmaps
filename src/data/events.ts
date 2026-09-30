import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDisplayNames } from "@/data/account";
import { toSkills, type Skill } from "@/domain/volunteer";

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

/** Alguien apuntado a un evento, tal como lo ve la organización. */
export interface Attendee {
  userId: string;
  name: string;
  /** Sus oficios, si los dijo. Vacío sin `db/16_voluntariado.sql`. */
  skills: Skill[];
  /** Cuándo confirmó la organización que vino; `null` si todavía no. */
  attendedAt: string | null;
}

/** Sin las columnas de la 15, no volver a pedirlas. */
let sinVoluntariado = false;

function faltaColumna(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Nombre y oficios de unas personas. La política `profiles_attendee_read` abre justo esa
 * fila a la organización de un evento al que se apuntaron, y nada más: el correo no está
 * en `profiles`.
 */
async function perfiles(sb: SupabaseClient, ids: string[]): Promise<Map<string, { name: string; skills: Skill[] }>> {
  const out = new Map<string, { name: string; skills: Skill[] }>();
  if (ids.length === 0) return out;
  if (!sinVoluntariado) {
    const { data, error } = await sb.from("profiles").select("user_id,display_name,skills").in("user_id", ids);
    if (!error && data) {
      for (const r of data as Row[]) {
        out.set(String(r.user_id), { name: String(r.display_name ?? ""), skills: toSkills(r.skills) });
      }
      return out;
    }
    if (faltaColumna(error)) sinVoluntariado = true;
    else return out;
  }
  const names = await fetchDisplayNames(sb, ids);
  for (const [id, name] of names) out.set(id, { name, skills: [] });
  return out;
}

/** Quién va a un evento, para la organización, en el orden en que se apuntaron. */
export async function fetchAttendees(sb: SupabaseClient, activityId: string): Promise<Attendee[]> {
  if (tablaAusente) return [];
  const leer = (cols: string) =>
    sb.from("activity_attendees").select(cols).eq("activity_id", activityId).order("created_at", { ascending: true });
  let { data, error } = await leer(sinVoluntariado ? "user_id" : "user_id,attended_at");
  if (faltaColumna(error)) {
    sinVoluntariado = true;
    ({ data, error } = await leer("user_id"));
  }
  if (falta(error)) tablaAusente = true;
  if (error || !data) return [];
  const rows = data as unknown as Row[];
  const people = await perfiles(sb, rows.map((r) => String(r.user_id)));
  return rows.map((r) => {
    const id = String(r.user_id);
    const p = people.get(id);
    return {
      userId: id,
      name: p?.name ?? "",
      skills: p?.skills ?? [],
      attendedAt: typeof r.attended_at === "string" ? r.attended_at : null,
    };
  });
}

/** Un evento que ya pasó y tiene gente apuntada sin confirmar. */
export interface AttendanceToConfirm {
  activityId: string;
  title: string;
  startsAt: string;
  people: Attendee[];
}

/** La ventana en la que la base deja confirmar: igual que `confirm_attendance`. */
const VENTANA_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * La bandeja de la organización: sus eventos que ya empezaron (y no hace más de 30 días
 * que terminaron) con gente apuntada a la que nadie ha dicho todavía si vino. El más
 * reciente primero, que es el que la organización tiene fresco.
 */
export async function fetchAttendanceToConfirm(
  sb: SupabaseClient,
  locationId: string,
  myUserId: string | null,
): Promise<AttendanceToConfirm[]> {
  if (tablaAusente || sinVoluntariado) return [];
  const { data, error } = await sb
    .from("activity_attendees")
    .select("user_id,activity_id,activities(id,title,starts_at,ends_at,status)")
    .eq("location_id", locationId)
    .is("attended_at", null);
  if (falta(error)) tablaAusente = true;
  if (faltaColumna(error)) sinVoluntariado = true;
  if (error || !data) return [];

  const ahora = Date.now();
  const grupos = new Map<string, AttendanceToConfirm>();
  const ids: string[] = [];
  for (const row of data as Row[]) {
    const a = (Array.isArray(row.activities) ? row.activities[0] : row.activities) as Row | null;
    if (!a || a.status === "cancelled") continue;
    const inicio = new Date(String(a.starts_at ?? "")).getTime();
    const fin = typeof a.ends_at === "string" ? new Date(a.ends_at).getTime() : inicio + 12 * 60 * 60 * 1000;
    if (!(inicio <= ahora) || fin < ahora - VENTANA_MS) continue;
    const userId = String(row.user_id);
    // A uno mismo no se le confirma: la base lo ignora, así que tampoco se ofrece.
    if (userId === myUserId) continue;
    const id = String(a.id);
    let g = grupos.get(id);
    if (!g) {
      g = { activityId: id, title: String(a.title ?? ""), startsAt: String(a.starts_at), people: [] };
      grupos.set(id, g);
    }
    g.people.push({ userId, name: "", skills: [], attendedAt: null });
    ids.push(userId);
  }

  const people = await perfiles(sb, [...new Set(ids)]);
  const out = [...grupos.values()];
  for (const g of out) {
    for (const p of g.people) {
      const x = people.get(p.userId);
      p.name = x?.name ?? "";
      p.skills = x?.skills ?? [];
    }
  }
  return out.sort((x, y) => y.startsAt.localeCompare(x.startsAt));
}

/**
 * «Vinieron». La base comprueba que el evento es de quien confirma, que ya empezó y que no
 * pasó hace más de 30 días; y el trigger otorga la experiencia. Devuelve cuántas quedaron.
 */
export async function confirmAttendance(sb: SupabaseClient, activityId: string, userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const { data, error } = await sb.rpc("confirm_attendance", { p_activity: activityId, p_users: userIds });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
