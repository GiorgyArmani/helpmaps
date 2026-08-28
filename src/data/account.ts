import type { SupabaseClient } from "@supabase/supabase-js";
import type { PointReport, Profile, ReportCounts, ReportKind } from "@/domain/account";

/**
 * Lo que una persona puede leer y escribir sobre SÍ MISMA.
 *
 * Igual que el resto de `src/data/`: este módulo pregunta y la base decide. Cada función
 * de acá se llama con el cliente de la propia persona, así que las políticas de
 * `db/01_esquema.sql § 010_accounts` son las que acotan el alcance — no un `where` que se pueda
 * olvidar. Un `select` sin filtro sobre `favourites` devuelve sólo las filas de quien
 * consulta porque la política dice `user_id = auth.uid()`, no porque acá lo pidamos.
 *
 * Esa distinción importa el día que alguien agregue una consulta nueva: si se olvida del
 * filtro, sigue sin haber fuga.
 *
 * ── LO PROPIO SE PIDE PROPIO ────────────────────────────────────────────────
 *
 * Ese razonamiento vale para `favourites`, y SÓLO para ella: es la única tabla cuya
 * política no tiene excepción de equipo. `submissions`, `volunteer_requests` y
 * `point_reports` llevan además una política de staff, y en Postgres las políticas
 * permisivas se SUMAN — el alcance real de un `select` de alguien del equipo es "lo mío O
 * toda la emergencia".
 *
 * Así que las funciones `fetchMy*` filtran por `auth.uid()` explícitamente. No es cinturón
 * y tirantes: sin el filtro, un voluntario abre su cuenta y ve los envíos de otra gente
 * bajo el rótulo "lo que enviaste". La RLS impide la FUGA; que un dato sea TUYO lo tiene
 * que pedir la consulta.
 */

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

interface ProfileRow {
  user_id: string;
  display_name: string;
  region: string | null;
  created_at: string;
}

function toProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    region: row.region,
    createdAt: row.created_at,
  };
}

/** El perfil de quien tiene la sesión. `null` si todavía no existe. */
export async function fetchMyProfile(sb: SupabaseClient): Promise<Profile | null> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("user_id,display_name,region,created_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return toProfile(data as ProfileRow);
}

/** Cambiar el nombre para mostrar o el estado. Sólo el propio: lo impone la RLS. */
export async function updateMyProfile(
  sb: SupabaseClient,
  patch: { displayName?: string; region?: string | null },
): Promise<void> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("sin sesión");
  const row: Record<string, unknown> = {};
  if (patch.displayName !== undefined) row.display_name = patch.displayName;
  if (patch.region !== undefined) row.region = patch.region;
  if (Object.keys(row).length === 0) return;

  const { error } = await sb.from("profiles").update(row).eq("user_id", auth.user.id);
  if (error) throw error;
}

/**
 * Los nombres del equipo, por id, para pintar una cola.
 *
 * Devuelve un mapa y no una lista porque quien llama ya tiene las postulaciones o los
 * reportes y sólo le falta ponerles cara. Un id sin perfil se omite en vez de inventar
 * un nombre: pasa con las cuentas del equipo creadas antes de `010`, y "—" es más honesto
 * que un correo colado donde dijimos que no habría correos.
 */
export async function fetchDisplayNames(
  sb: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;

  const { data, error } = await sb.from("profiles").select("user_id,display_name").in("user_id", ids);
  if (error || !data) return out;
  for (const row of data as Pick<ProfileRow, "user_id" | "display_name">[]) {
    out.set(row.user_id, row.display_name);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Guardados
//
// La tabla de la que NADIE más lee, ni un superadmin. Ver `db/01_esquema.sql § 010_accounts` § 2.
// ---------------------------------------------------------------------------

/** Los ids de los puntos que esta persona guardó. */
export async function fetchMyFavourites(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb
    .from("favourites")
    .select("location_id")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as { location_id: string }[]).map((r) => r.location_id);
}

/**
 * Guardar o dejar de guardar. Devuelve el estado que quedó.
 *
 * `user_id` se escribe explícito aunque la política ya lo exija: sin él el insert falla
 * contra el `with check`, porque la columna no tiene default y la política compara contra
 * lo que se manda.
 */
export async function toggleFavourite(
  sb: SupabaseClient,
  locationId: string,
  on: boolean,
): Promise<boolean> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("sin sesión");

  if (on) {
    const { error } = await sb
      .from("favourites")
      .upsert({ user_id: auth.user.id, location_id: locationId }, { onConflict: "user_id,location_id" });
    if (error) throw error;
    return true;
  }

  const { error } = await sb.from("favourites").delete().eq("location_id", locationId);
  if (error) throw error;
  return false;
}

// ---------------------------------------------------------------------------
// Reportes sobre un punto
// ---------------------------------------------------------------------------

interface ReportRow {
  id: string;
  location_id: string;
  user_id: string;
  kind: ReportKind;
  note: string | null;
  status: PointReport["status"];
  created_at: string;
}

function toReport(row: ReportRow): PointReport {
  return {
    id: row.id,
    locationId: row.location_id,
    userId: row.user_id,
    kind: row.kind,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * "Esto sigue abierto" / "ya cerró" / "el dato está mal".
 *
 * No toca `center_info`: es una señal para la cola del panel. El índice único parcial de
 * `010` rechaza un segundo reporte de la misma persona sobre el mismo punto mientras el
 * primero siga pendiente, así que un doble toque devuelve el conflicto en vez de inflar
 * el recuento — y eso se traduce acá a "ya lo reportaste", no a un error.
 */
export async function createPointReport(
  sb: SupabaseClient,
  input: { locationId: string; kind: ReportKind; note?: string | null },
): Promise<{ ok: boolean; duplicate?: boolean }> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("sin sesión");

  const { error } = await sb.from("point_reports").insert({
    location_id: input.locationId,
    user_id: auth.user.id,
    kind: input.kind,
    note: input.note?.trim() || null,
  });

  // 23505 = unique_violation. Es el índice parcial de arriba haciendo su trabajo.
  if (error) {
    if (error.code === "23505") return { ok: false, duplicate: true };
    throw error;
  }
  return { ok: true };
}

/**
 * Los reportes que hizo esta persona, para que pueda ver si sirvieron de algo.
 *
 * El `.eq("user_id", …)` no es redundante: ver la nota de "LO PROPIO SE PIDE PROPIO" en la
 * cabecera de este archivo. `point_reports_read` dice `user_id = auth.uid() OR
 * can_edit(emergency_id)`, así que sin el filtro alguien del equipo recibiría acá la cola
 * entera de su emergencia como si la hubiera escrito.
 */
export async function fetchMyReports(sb: SupabaseClient): Promise<PointReport[]> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await sb
    .from("point_reports")
    .select("id,location_id,user_id,kind,note,status,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (data as ReportRow[]).map(toReport);
}

/** Cuánta gente dice cada cosa, por punto. Para ordenar la cola del panel. */
export async function fetchReportCounts(sb: SupabaseClient): Promise<ReportCounts[]> {
  const { data, error } = await sb
    .from("point_report_counts")
    .select("location_id,sigue_abierto,ya_cerro,dato_incorrecto,ultimo");
  if (error || !data) return [];
  return (
    data as {
      location_id: string;
      sigue_abierto: number;
      ya_cerro: number;
      dato_incorrecto: number;
      ultimo: string | null;
    }[]
  ).map((r) => ({
    locationId: r.location_id,
    sigueAbierto: Number(r.sigue_abierto) || 0,
    yaCerro: Number(r.ya_cerro) || 0,
    datoIncorrecto: Number(r.dato_incorrecto) || 0,
    ultimo: r.ultimo,
  }));
}

// ---------------------------------------------------------------------------
// Lo que mandé
// ---------------------------------------------------------------------------

export interface MySubmission {
  id: string;
  kind: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
}

/**
 * Las sugerencias propias, con su estado.
 *
 * Es la razón principal por la que alguien se haría una cuenta acá: hoy una sugerencia
 * anónima cae en un pozo sin fondo y quien la mandó nunca sabe si sirvió.
 */
export async function fetchMySubmissions(sb: SupabaseClient): Promise<MySubmission[]> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return [];
  // Filtro explícito, y obligatorio: `submissions_staff_read` deja leer toda la emergencia
  // a quien es del equipo. Sin este `.eq` un voluntario abriría "lo que enviaste" y leería
  // cincuenta mensajes de otra gente presentados como suyos.
  const { data, error } = await sb
    .from("submissions")
    .select("id,kind,message,status,created_at,reviewed_at")
    .eq("created_by", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return (
    data as {
      id: string;
      kind: string;
      message: string;
      status: MySubmission["status"];
      created_at: string;
      reviewed_at: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  }));
}

export interface MyVolunteerRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedAt: string | null;
}

/**
 * La postulación propia, si hay. El índice de `010` garantiza una sola viva.
 *
 * De las tres, ésta era la peor sin filtro: `volunteer_requests_admin_read` deja leer las
 * de toda la emergencia, y con `.limit(1)` un admin recibía la postulación más reciente de
 * CUALQUIERA como si fuera la suya — "tu postulación está pendiente", y sin botón para
 * postularse.
 */
export async function fetchMyVolunteerRequest(
  sb: SupabaseClient,
): Promise<MyVolunteerRequest | null> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb
    .from("volunteer_requests")
    .select("id,status,created_at,reviewed_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as {
    id: string;
    status: MyVolunteerRequest["status"];
    created_at: string;
    reviewed_at: string | null;
  };
  return { id: r.id, status: r.status, createdAt: r.created_at, reviewedAt: r.reviewed_at };
}

export interface FavouriteCenter {
  id: string;
  name: string;
  type: string;
  region: string | null;
}

/**
 * Los puntos guardados, ya con nombre.
 *
 * Dos consultas y no un join anidado de PostgREST: `favourites` y `locations` viven bajo
 * políticas distintas —una privadísima, la otra pública— y un embebido las mezcla en una
 * sola respuesta cuyo alcance cuesta razonar. Separadas, cada una la acota su propia
 * política y se lee de un vistazo cuál devuelve qué.
 */
export async function fetchFavouriteCenters(sb: SupabaseClient): Promise<FavouriteCenter[]> {
  const ids = await fetchMyFavourites(sb);
  if (ids.length === 0) return [];

  const { data, error } = await sb
    .from("locations")
    .select("id,name,type,region")
    .in("id", ids);
  if (error || !data) return [];

  const rows = data as FavouriteCenter[];
  // En el orden en que se guardaron, que es el que devuelve `fetchMyFavourites`: lo más
  // reciente primero. El `in` de arriba no conserva orden.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is FavouriteCenter => Boolean(r));
}

// ---------------------------------------------------------------------------
// La cola de reportes, como la ve el equipo
// ---------------------------------------------------------------------------

export interface QueuedReport {
  id: string;
  kind: ReportKind;
  note: string | null;
  createdAt: string;
  /** El nombre para mostrar de quien lo envió. Nunca su correo. */
  by: string | null;
}

/** Todos los avisos pendientes sobre UN punto, que es como se revisan. */
export interface ReportGroup {
  locationId: string;
  locationName: string;
  region: string | null;
  sigueAbierto: number;
  yaCerro: number;
  datoIncorrecto: number;
  /** El más reciente del grupo: ordena la cola. */
  ultimo: string;
  reports: QueuedReport[];
}

/**
 * Los avisos sin resolver, agrupados por punto.
 *
 * ── AGRUPADOS, Y NO UNA LISTA PLANA ─────────────────────────────────────────
 *
 * Una lista plana de avisos hace que un admin lea veinte veces "sigue abierto" y decida
 * veinte veces. Agrupados, la pregunta cambia: deja de ser "¿le creo a esta persona?" y
 * pasa a ser "¿le creo a las cinco que dicen lo mismo?". Esa segunda pregunta se responde
 * mucho mejor, y es toda la ventaja de tener avisos de gente sin permisos de escritura.
 *
 * ── LO QUE ESTA CONSULTA NO TRAE ────────────────────────────────────────────
 *
 * El correo de quien reportó. No está en `profiles` y esta función no lo busca: el equipo
 * revisa el aviso, no a la persona. Si hace falta contactar a alguien, eso pasa por una
 * ruta con `requireAdmin()` y queda en el registro de auditoría.
 */
export async function fetchPendingReports(sb: SupabaseClient): Promise<ReportGroup[]> {
  const { data, error } = await sb
    .from("point_reports")
    .select("id,location_id,user_id,kind,note,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data || data.length === 0) return [];

  const rows = data as ReportRow[];

  // Nombres de los puntos y de quienes reportaron, en dos consultas y no en un embebido:
  // las tres tablas viven bajo políticas distintas y separadas se razonan de una.
  const [locRes, names] = await Promise.all([
    sb.from("locations").select("id,name,region").in("id", [...new Set(rows.map((r) => r.location_id))]),
    fetchDisplayNames(sb, rows.map((r) => r.user_id)),
  ]);
  const locs = new Map(
    ((locRes.data ?? []) as { id: string; name: string; region: string | null }[]).map((l) => [
      l.id,
      l,
    ]),
  );

  const groups = new Map<string, ReportGroup>();
  for (const r of rows) {
    let g = groups.get(r.location_id);
    if (!g) {
      const loc = locs.get(r.location_id);
      g = {
        locationId: r.location_id,
        // Un punto borrado deja sus avisos huérfanos por un momento; el id es más honesto
        // que un hueco en blanco, y deja buscarlo.
        locationName: loc?.name ?? r.location_id,
        region: loc?.region ?? null,
        sigueAbierto: 0,
        yaCerro: 0,
        datoIncorrecto: 0,
        ultimo: r.created_at,
        reports: [],
      };
      groups.set(r.location_id, g);
    }
    if (r.kind === "sigue_abierto") g.sigueAbierto += 1;
    else if (r.kind === "ya_cerro") g.yaCerro += 1;
    else g.datoIncorrecto += 1;
    if (r.created_at > g.ultimo) g.ultimo = r.created_at;
    g.reports.push({
      id: r.id,
      kind: r.kind,
      note: r.note,
      createdAt: r.created_at,
      by: names.get(r.user_id) ?? null,
    });
  }

  return [...groups.values()].sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));
}

/**
 * Resolver todos los avisos pendientes de un punto.
 *
 * `applied` cuando el equipo actuó sobre lo que decían; `dismissed` cuando no. El trigger
 * `point_reports_guard_trg` de `010` sella quién y cuándo, y rechaza el cambio si quien lo
 * intenta no es del equipo — así que esto no puede convertirse en una puerta trasera aunque
 * alguien lo llame desde otro sitio.
 */
export async function resolveReports(
  sb: SupabaseClient,
  locationId: string,
  status: "applied" | "dismissed",
): Promise<void> {
  const { error } = await sb
    .from("point_reports")
    .update({ status })
    .eq("location_id", locationId)
    .eq("status", "pending");
  if (error) throw error;
}
