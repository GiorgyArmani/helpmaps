import type { SupabaseClient } from "@supabase/supabase-js";

// Seguir a una organización (`db/19_seguir_y_verificada.sql`).
//
// Es distinto de guardar: guardar es «lo quiero a mano» (un refugio cerca de casa), seguir
// es «quiero enterarme de lo que hace». Quién sigue a quién lo lee sólo su dueño; el número
// de seguidores es público.
//
// Ninguna lectura lanza. En una base sin la migración, `followsAvailable()` pasa a falso y
// la interfaz esconde el botón en vez de enseñar uno que no hace nada.

/** `42P01` undefined_table; `PGRST205` la misma respuesta desde la caché de PostgREST. */
function faltaLaTabla(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

// Un hecho del despliegue, no de un componente: la primera respuesta que diga que la tabla
// no existe lo apaga para toda la pestaña. Recargar vuelve a probar.
let ausente = false;

export function followsAvailable(): boolean {
  return !ausente;
}

/** Los ids de las organizaciones que sigue la persona con sesión. */
export async function fetchMyFollows(sb: SupabaseClient): Promise<string[]> {
  if (ausente) return [];
  const { data, error } = await sb
    .from("center_follows")
    .select("location_id")
    .order("created_at", { ascending: false });
  if (error) {
    if (faltaLaTabla(error)) ausente = true;
    return [];
  }
  return ((data ?? []) as { location_id: string }[]).map((r) => r.location_id);
}

/** Cuántas cuentas siguen un punto. 0 si nadie, o si la base no tiene la tabla. */
export async function fetchFollowersCount(sb: SupabaseClient, locationId: string): Promise<number> {
  if (ausente) return 0;
  const { data, error } = await sb
    .from("center_stats")
    .select("followers_count")
    .eq("location_id", locationId)
    .maybeSingle();
  if (error) {
    if (faltaLaTabla(error)) ausente = true;
    return 0;
  }
  const n = (data as { followers_count?: number } | null)?.followers_count;
  return typeof n === "number" ? n : 0;
}

/** Seguir o dejar de seguir. Devuelve el estado que quedó. */
export async function setFollow(sb: SupabaseClient, locationId: string, on: boolean): Promise<boolean> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("sin sesión");

  if (on) {
    const { error } = await sb
      .from("center_follows")
      .upsert({ user_id: auth.user.id, location_id: locationId }, { onConflict: "user_id,location_id" });
    if (error) throw error;
    return true;
  }
  const { error } = await sb.from("center_follows").delete().eq("location_id", locationId);
  if (error) throw error;
  return false;
}

// Sin `db/24_seguidores_avatar.sql` la función no existe: se deja de pedir en la pestaña y
// el perfil enseña sólo el número.
let sinAvatares = false;

/**
 * Los avatares de quienes siguen un punto, el más reciente primero. Sólo el dibujo: la base
 * no devuelve ni nombres ni ids (`follower_avatars`). Crudo: quien lo pinta lo valida contra
 * el catálogo de su país.
 */
export async function fetchFollowerAvatars(
  sb: SupabaseClient,
  locationId: string,
  limit = 5,
): Promise<unknown[]> {
  if (ausente || sinAvatares) return [];
  const { data, error } = await sb.rpc("follower_avatars", { p_location: locationId, p_limit: limit });
  if (error) {
    // `PGRST202` la función no está en la caché de PostgREST; `42883` no existe.
    if (error.code === "PGRST202" || error.code === "42883") sinAvatares = true;
    return [];
  }
  return Array.isArray(data) ? data : [];
}
