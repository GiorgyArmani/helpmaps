import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContributionKind } from "@/domain/badges";

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
 * Anotar algo que alguien acaba de hacer.
 *
 * Pasa por la función `record_contribution`, que es la ÚNICA puerta: `contributions` no
 * tiene política de INSERT, precisamente para que nadie pueda regalarse puntos con una
 * petición desde la consola del navegador.
 *
 * No lanza. Anotar es un efecto secundario de la acción de verdad —confirmar un punto,
 * declarar un aporte— y si falla, esa acción ya ocurrió y no puede deshacerse por esto.
 * Un error aquí no le da a nadie nada que hacer.
 */
export async function recordContribution(
  sb: SupabaseClient,
  kind: ContributionKind,
  locationId: string | null = null,
  points = 1,
): Promise<void> {
  if (tablasAusentes) return;
  const { error } = await sb.rpc("record_contribution", {
    p_kind: kind,
    p_location_id: locationId,
    p_points: points,
  });
  if (faltaLaTabla(error)) tablasAusentes = true;
}

/** Otorgar una medalla. Idempotente en la base; tampoco lanza, por lo mismo. */
export async function awardBadge(sb: SupabaseClient, code: string): Promise<void> {
  if (tablasAusentes) return;
  const { error } = await sb.rpc("award_badge", { p_badge: code });
  if (faltaLaTabla(error)) tablasAusentes = true;
}

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
