import type { SupabaseClient } from "@supabase/supabase-js";

// Lecturas y escrituras de medallas, puntos y tabla de posiciones.
//
// Como en `initiatives.ts`, las lecturas devuelven vacío ante cualquier fallo: estas
// tablas viven en una migración (`db/06_reconocimiento.sql`) que muchos despliegues no han
// corrido, y eso NO puede ser el motivo de que no se vea una cuenta.

type Row = Record<string, unknown>;

/** Ver la nota gemela en `initiatives.ts`: sin esto son peticiones 404 en cada pantalla. */
let tablasAusentes = false;

function faltaLaTabla(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export interface ContributionRow {
  kind: string;
  points: number;
  created_at: string;
}

export interface LeaderRow {
  user_id: string;
  display_name: string;
  points: number;
  actions: number;
}

export interface AwardedBadge {
  badge: string;
  awarded_at: string;
}

/**
 * Lo que ha hecho ESTA persona.
 *
 * Sin `user_id` en el filtro: la política de `contributions` es `user_id = auth.uid()` sin
 * excepción para nadie, así que un `select` sin filtro ya devuelve exactamente lo suyo y
 * sólo lo suyo. Añadir el filtro daría una segunda respuesta a la misma pregunta.
 */
export async function fetchMyContributions(sb: SupabaseClient): Promise<ContributionRow[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("contributions")
    .select("kind,points,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map((r) => ({
    kind: String(r.kind),
    points: typeof r.points === "number" ? r.points : Number(r.points) || 0,
    created_at: String(r.created_at ?? ""),
  }));
}

export async function fetchMyBadges(sb: SupabaseClient): Promise<AwardedBadge[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("user_badges")
    .select("badge,awarded_at")
    .order("awarded_at", { ascending: false });
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map((r) => ({
    badge: String(r.badge),
    awarded_at: String(r.awarded_at ?? ""),
  }));
}

/**
 * La tabla de posiciones.
 *
 * Sale de la VISTA `leaderboard`, no de las tablas: la vista sólo expone nombre y total, y
 * es lo único de todo este módulo que ve alguien sobre otra persona. Nunca un lugar. Ver
 * el encabezado de `db/06_reconocimiento.sql`.
 */
export async function fetchLeaderboard(sb: SupabaseClient, limit = 25): Promise<LeaderRow[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("leaderboard")
    .select("user_id,display_name,points,actions")
    .limit(limit);
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map((r) => ({
    user_id: String(r.user_id),
    display_name: String(r.display_name ?? ""),
    points: Number(r.points) || 0,
    actions: Number(r.actions) || 0,
  }));
}

/**
 * NO HAY forma de anotar experiencia desde el cliente, y es deliberado.
 *
 * Existió una `recordContribution()` que llamaba a la función de la base. Se quitó al
 * repesar las acciones: mientras todo valía 1 era discutible, pero con un check-in
 * valiendo 10 y una donación 15, una llamada abierta desde el navegador es el nivel
 * puesto a la venta por el precio de abrir la consola.
 *
 * Ahora la experiencia la otorgan:
 *
 *   • TRIGGERS en la base — `reward_applied_report` corre cuando el equipo aplica un
 *     aviso, colgado del hecho y no de ninguna pantalla.
 *   • El SERVIDOR con el service role, después de comprobar que la acción ocurrió: es
 *     donde irán el check-in por código y la confirmación de un aporte.
 *
 * Si alguna vez esto vuelve a hacer falta desde el cliente, la pregunta que hay que
 * responder antes es: ¿qué impide que quien llama se lo invente?
 */

/**
 * NO hay forma de otorgarse una medalla desde el cliente, y también es deliberado.
 *
 * Existió una `awardBadge()`. Se quitó junto con la función de la base: cualquiera podía
 * pedirse «Vigía» desde la consola sin haber confirmado nada, y una distinción que se
 * reclama sola no distingue nada.
 *
 * Ahora las otorga un trigger sobre `contributions` (`evaluate_badges`), contando lo que
 * de verdad hay. La aplicación sólo las LEE — `src/domain/badges.ts` describe las mismas
 * reglas para poder dibujar cuáles faltan, pero quien decide es la base.
 */

/** Salir o dejar de salir en la tabla de posiciones. Esto SÍ lanza: lo pidió una persona. */
export async function setLeaderboardOptIn(
  sb: SupabaseClient,
  userId: string,
  optIn: boolean,
): Promise<void> {
  const { error } = await sb
    .from("profiles")
    .update({ leaderboard_opt_in: optIn })
    .eq("user_id", userId);
  if (error) throw error;
}
