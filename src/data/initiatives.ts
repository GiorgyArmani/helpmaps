import type { SupabaseClient } from "@supabase/supabase-js";
import type { Activity, Campaign, InitiativePost } from "@/domain/types";

// Lecturas y escrituras contra `campaigns`, `activities` e `initiative_posts`.
// Una lista de columnas explícita, como en el resto de módulos de datos: nunca
// `select("*")` sobre una tabla que puede crecer.
//
// TODAS las lecturas devuelven lista vacía si algo falla, igual que `donations.ts`, y por
// la misma razón elevada al cuadrado: estas tablas viven en una migración
// (`db/05_iniciativas.sql`) que muchos despliegues aún no han corrido. En esos, la
// consulta responde «relation does not exist» — y eso NO puede ser el motivo de que no se
// vea la ficha de un refugio. Una iniciativa sin campañas y un despliegue sin la
// migración se ven igual desde aquí, que es exactamente lo que queremos.

const CAMPAIGN_COLUMNS =
  "id,location_id,title,purpose,goal_amount,goal_unit,raised_amount,raised_declared_at,starts_on,ends_on,status,updated_at";

const ACTIVITY_COLUMNS =
  "id,location_id,title,description,starts_at,ends_at,place,needs_volunteers,status";

const POST_COLUMNS = "id,location_id,campaign_id,kind,body,photo_url,created_at";

type Row = Record<string, unknown>;

/**
 * Si la migración no está corrida, no volver a preguntar.
 *
 * PostgREST responde 404 «relation does not exist» a cada consulta contra una tabla que
 * no existe. Sin esta bandera son TRES peticiones fallidas por cada ficha que alguien
 * abre: tres viajes perdidos en la conexión de una barra que este proyecto da por
 * supuesta, y la consola llena de rojo que esconde los errores de verdad.
 *
 * Se apaga con la primera respuesta que diga que la tabla falta, y se queda apagada
 * mientras dure la pestaña. Recargar vuelve a intentarlo, que es justo lo que hará quien
 * acabe de correr la migración.
 *
 * `let` de módulo y no estado de React a propósito: es un hecho del despliegue, no de un
 * componente, y lo comparten todas las fichas que se abran.
 */
let tablasAusentes = false;

/**
 * Lo mismo, para las dos columnas de cobro.
 *
 * Bandera aparte y no la de arriba: `center_info` existe desde la primera migración del
 * proyecto, así que una consulta suya nunca da «no existe la tabla» — da «no existe la
 * columna» (42703). Con una sola bandera, ese fallo habría apagado también las campañas y
 * la agenda en una base donde sí están.
 */
let columnasCobroAusentes = false;

/** ¿«No existe la columna»? `42703` es `undefined_column`; `PGRST204` su equivalente. */
function faltaLaColumna(error: { code?: string } | null): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * ¿Este error es «la tabla no existe»?
 *
 * Se mira el código y no el mensaje: `42P01` es el `undefined_table` de PostgreSQL y no
 * cambia con el idioma ni con la versión de PostgREST. `PGRST205` es el equivalente
 * cuando quien contesta es la caché de esquema de PostgREST y ni siquiera llega a la
 * base. Cualquier otro error —permisos, red, un filtro mal escrito— NO apaga la bandera:
 * un corte de red pasajero no puede dejar sin campañas a un despliegue que sí las tiene.
 */
function faltaLaTabla(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function text(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

/**
 * PostgREST devuelve `numeric` como STRING, no como number: sin esta conversión
 * `raised / goal` da `NaN` y la barra de progreso se dibuja vacía en una campaña que va
 * por la mitad. Es el fallo silencioso clásico de esta capa.
 */
function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function mapCampaign(row: Row): Campaign {
  return {
    id: String(row.id),
    location_id: String(row.location_id),
    title: String(row.title ?? "").trim(),
    purpose: String(row.purpose ?? "").trim(),
    goal_amount: num(row.goal_amount),
    goal_unit: String(row.goal_unit ?? "").trim(),
    raised_amount: num(row.raised_amount),
    raised_declared_at: text(row.raised_declared_at),
    starts_on: String(row.starts_on ?? ""),
    ends_on: text(row.ends_on),
    status: (row.status as Campaign["status"]) ?? "draft",
    updated_at: text(row.updated_at),
  };
}

function mapActivity(row: Row): Activity {
  return {
    id: String(row.id),
    location_id: String(row.location_id),
    title: String(row.title ?? "").trim(),
    description: text(row.description),
    starts_at: String(row.starts_at ?? ""),
    ends_at: text(row.ends_at),
    place: text(row.place),
    needs_volunteers: row.needs_volunteers === true,
    status: (row.status as Activity["status"]) ?? "scheduled",
  };
}

function mapPost(row: Row): InitiativePost {
  return {
    id: String(row.id),
    location_id: String(row.location_id),
    campaign_id: text(row.campaign_id),
    kind: (row.kind as InitiativePost["kind"]) ?? "avance",
    body: String(row.body ?? "").trim(),
    photo_url: text(row.photo_url),
    created_at: String(row.created_at ?? ""),
  };
}

/** Todo lo que la ficha de un punto necesita, en una sola espera. */
export interface InitiativeProfile {
  campaigns: Campaign[];
  activities: Activity[];
  posts: InitiativePost[];
  /** Por dónde recibe ESTE punto. Vacío = no lo ha puesto, y entonces no se ofrece. */
  donate: { info: string | null; url: string | null };
}

export const EMPTY_PROFILE: InitiativeProfile = {
  campaigns: [],
  activities: [],
  posts: [],
  donate: { info: null, url: null },
};

/**
 * Los datos de cobro del punto, dos columnas.
 *
 * Consulta suelta y no columnas nuevas en la carga de centros, por lo mismo que
 * `fetchCenterProfile`: esa carga baja el país entero a cada visitante, y esto sólo hace
 * falta cuando alguien abre UNA ficha.
 */
export async function fetchDonateInfo(
  sb: SupabaseClient,
  locationId: string,
): Promise<InitiativeProfile["donate"]> {
  if (columnasCobroAusentes) return { info: null, url: null };
  const { data, error } = await sb
    .from("center_info")
    .select("donate_info,donate_url")
    .eq("location_id", locationId)
    .maybeSingle();
  if (faltaLaColumna(error)) columnasCobroAusentes = true;
  if (error || !data) return { info: null, url: null };
  const row = data as unknown as Row;
  return { info: text(row.donate_info), url: text(row.donate_url) };
}

/**
 * Las campañas vivas de un punto, la más reciente primero.
 *
 * Las cerradas no salen aquí: una ficha encabezada por tres metas cerradas dice «esto ya
 * pasó» de la iniciativa que sigue trabajando. Lo que se hizo se cuenta en las entradas.
 */
export async function fetchCampaigns(sb: SupabaseClient, locationId: string): Promise<Campaign[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("location_id", locationId)
    .in("status", ["active", "reached"])
    .order("starts_on", { ascending: false });
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map(mapCampaign);
}

/**
 * Lo que viene, lo primero arriba.
 *
 * El corte por fecha es en SERVIDOR y no en cliente a propósito: una agenda que en un
 * teléfono con la hora mal puesta esconde la jornada de mañana es peor que no tenerla.
 * Se dan 12 horas de margen hacia atrás para que algo que empezó esta mañana siga a la
 * vista el resto del día — que es cuando la gente lo busca.
 */
export async function fetchActivities(sb: SupabaseClient, locationId: string): Promise<Activity[]> {
  if (tablasAusentes) return [];
  const desde = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("activities")
    .select(ACTIVITY_COLUMNS)
    .eq("location_id", locationId)
    .eq("status", "scheduled")
    .gte("starts_at", desde)
    .order("starts_at", { ascending: true })
    .limit(20);
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map(mapActivity);
}

/** Lo que ya hizo, lo más reciente primero. */
export async function fetchPosts(
  sb: SupabaseClient,
  locationId: string,
  limit = 10,
): Promise<InitiativePost[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("initiative_posts")
    .select(POST_COLUMNS)
    .eq("location_id", locationId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map(mapPost);
}

/**
 * Las tres consultas a la vez.
 *
 * En paralelo y no en serie: son independientes, y encadenarlas triplica la espera de la
 * ficha en la conexión mala que este proyecto da por supuesta. `Promise.all` sin `catch`
 * basta porque ninguna de las tres puede rechazar — devuelven lista vacía en el error.
 */
export async function fetchInitiativeProfile(
  sb: SupabaseClient,
  locationId: string,
): Promise<InitiativeProfile> {
  const [campaigns, activities, posts, donate] = await Promise.all([
    fetchCampaigns(sb, locationId),
    fetchActivities(sb, locationId),
    fetchPosts(sb, locationId),
    fetchDonateInfo(sb, locationId),
  ]);
  return { campaigns, activities, posts, donate };
}

/**
 * ¿ESTA persona gestiona este punto? Decide si se le ofrece el panel de la iniciativa.
 *
 * El `eq("user_id")` es obligatorio y no una precaución: la política de lectura de
 * `center_managers` deja ver lo propio O, si eres del equipo de esa emergencia, lo de
 * cualquiera. Sin ese filtro, un voluntario del equipo abriendo un punto que tiene gestor
 * recibiría una fila —la de OTRA persona— y esta función diría «sí, es tuyo».
 *
 * Devuelve la lista de puntos gestionados en una sola consulta y no uno a uno: quien
 * gestiona algo suele gestionar uno o dos puntos, y preguntarlo en cada ficha que se abre
 * es una petición por toque de pin.
 */
export async function fetchManagedLocations(
  sb: SupabaseClient,
  userId: string,
): Promise<string[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("center_managers")
    .select("location_id")
    .eq("user_id", userId);
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map((r) => String(r.location_id));
}

// ───────────────────────────────────────────────────────────────────────────
// Escrituras.
//
// Ninguna comprueba permisos: el portero es RLS (`can_manage_location()` en
// db/05_iniciativas.sql), como en el resto de módulos de datos. Comprobarlo también aquí
// daría una segunda respuesta a la misma pregunta, y el día que las dos no coincidan gana
// la de la base — así que la de aquí sólo puede mentir.
//
// Y al revés que las lecturas, éstas SÍ lanzan: quien acaba de escribir una campaña tiene
// que enterarse de que no se guardó.
// ───────────────────────────────────────────────────────────────────────────

export interface CampaignDraft {
  id?: string;
  location_id: string;
  title: string;
  purpose: string;
  goal_amount: number;
  goal_unit: string;
  raised_amount: number;
  ends_on: string | null;
  status: Campaign["status"];
}

export async function saveCampaign(sb: SupabaseClient, draft: CampaignDraft): Promise<void> {
  const row = {
    location_id: draft.location_id,
    title: draft.title,
    purpose: draft.purpose,
    goal_amount: draft.goal_amount,
    goal_unit: draft.goal_unit,
    raised_amount: draft.raised_amount,
    ends_on: draft.ends_on,
    status: draft.status,
  };
  // `raised_declared_at` no se manda: lo sella un trigger cuando el número cambia (ver la
  // sección 6 de la migración). Una fecha de declaración puesta por el cliente es una
  // fecha que el cliente puede elegir.
  const { error } = draft.id
    ? await sb.from("campaigns").update(row).eq("id", draft.id)
    : await sb.from("campaigns").insert(row);
  if (error) throw error;
}

export interface ActivityDraft {
  id?: string;
  location_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  place: string | null;
  needs_volunteers: boolean;
  status: Activity["status"];
}

export async function saveActivity(sb: SupabaseClient, draft: ActivityDraft): Promise<void> {
  const row = {
    location_id: draft.location_id,
    title: draft.title,
    description: draft.description,
    starts_at: draft.starts_at,
    place: draft.place,
    needs_volunteers: draft.needs_volunteers,
    status: draft.status,
  };
  const { error } = draft.id
    ? await sb.from("activities").update(row).eq("id", draft.id)
    : await sb.from("activities").insert(row);
  if (error) throw error;
}

export interface PostDraft {
  location_id: string;
  campaign_id: string | null;
  kind: InitiativePost["kind"];
  body: string;
  photo_url: string | null;
}

export async function createPost(sb: SupabaseClient, draft: PostDraft): Promise<void> {
  const { error } = await sb.from("initiative_posts").insert({
    location_id: draft.location_id,
    campaign_id: draft.campaign_id,
    kind: draft.kind,
    body: draft.body,
    photo_url: draft.photo_url,
  });
  if (error) throw error;
}

/** Lo que el gestor rellena en el onboarding y mantiene después. */
export interface CenterProfileDraft {
  location_id: string;
  status: string | null;
  description: string | null;
  category: string | null;
  schedule: string | null;
  contact_name: string | null;
  needs: string | null;
  receives: string[];
  website: string | null;
  instagram: string | null;
  donate_info: string | null;
  donate_url: string | null;
}

/**
 * Guarda el perfil del punto.
 *
 * `upsert` y no `update`: `center_info` es 1:1 OPCIONAL con `locations`, y un punto que
 * el equipo publicó sin rellenar nada no tiene fila. Un `update` contra esa fila que no
 * existe NO falla — afecta a cero filas y devuelve éxito, que es la peor de las dos
 * salidas posibles: el gestor lee «guardado» y no se guardó nada.
 *
 * `markOnboarded` sella `onboarded_at` y es lo que da por terminado el onboarding. Se
 * pasa sólo en el último paso, no en cada guardado intermedio.
 */
export async function saveCenterProfile(
  sb: SupabaseClient,
  draft: CenterProfileDraft,
  markOnboarded = false,
): Promise<void> {
  const row: Record<string, unknown> = {
    location_id: draft.location_id,
    status: draft.status,
    description: draft.description,
    category: draft.category,
    schedule: draft.schedule,
    contact_name: draft.contact_name,
    needs: draft.needs,
    receives: draft.receives,
    website: draft.website,
    instagram: draft.instagram,
    donate_info: draft.donate_info,
    donate_url: draft.donate_url,
    updated_at: new Date().toISOString(),
  };
  if (markOnboarded) row.onboarded_at = new Date().toISOString();
  const { error } = await sb.from("center_info").upsert(row, { onConflict: "location_id" });
  if (error) throw error;
}

/**
 * Canjear una invitación. Devuelve el `location_id` del punto que se acaba de recibir.
 *
 * Toda la validación vive en la función de la base (`accept_center_invite`), la única que
 * puede leer `center_invites`: aquí sólo se pasa el token y se deja subir el error, cuyo
 * mensaje ya está escrito para que lo lea una persona.
 */
export async function acceptInvite(sb: SupabaseClient, token: string): Promise<string> {
  const { data, error } = await sb.rpc("accept_center_invite", { p_token: token });
  if (error) throw error;
  return String(data);
}

/**
 * El perfil de gestión de un punto: lo que el gestor edita, y si ya terminó el onboarding.
 *
 * Consulta APARTE, y no columnas nuevas en la carga de centros. Esa carga baja el país
 * entero a cada visitante —520 filas en Venezuela— y `onboarded_at`, `donate_info` y
 * `donate_url` sólo le importan a quien gestiona ESE punto. Meterlos allí habría hecho
 * pagar a todo el mundo, en la conexión mala de siempre, por un dato que casi nadie usa.
 */
export interface CenterProfile extends CenterProfileDraft {
  onboarded_at: string | null;
}

const PROFILE_COLUMNS =
  "location_id,status,description,category,schedule,contact_name,needs,receives,website,instagram,donate_info,donate_url,onboarded_at";

export async function fetchCenterProfile(
  sb: SupabaseClient,
  locationId: string,
): Promise<CenterProfile | null> {
  if (columnasCobroAusentes) return null;
  const { data, error } = await sb
    .from("center_info")
    .select(PROFILE_COLUMNS)
    .eq("location_id", locationId)
    .maybeSingle();
  if (faltaLaColumna(error)) columnasCobroAusentes = true;
  if (error || !data) return null;
  const row = data as unknown as Row;
  return {
    location_id: String(row.location_id),
    status: text(row.status),
    description: text(row.description),
    category: text(row.category),
    schedule: text(row.schedule),
    contact_name: text(row.contact_name),
    needs: text(row.needs),
    receives: Array.isArray(row.receives)
      ? row.receives.filter((x): x is string => typeof x === "string")
      : [],
    website: text(row.website),
    instagram: text(row.instagram),
    donate_info: text(row.donate_info),
    donate_url: text(row.donate_url),
    onboarded_at: text(row.onboarded_at),
  };
}

/** Un perfil vacío para un punto que todavía no tiene fila en `center_info`. */
export function emptyProfile(locationId: string): CenterProfile {
  return {
    location_id: locationId,
    status: null,
    description: null,
    category: null,
    schedule: null,
    contact_name: null,
    needs: null,
    receives: [],
    website: null,
    instagram: null,
    donate_info: null,
    donate_url: null,
    onboarded_at: null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Quien gestiona un punto, visto desde el panel del equipo.
//
// Dar acceso a un punto tenía camino y quitarlo no: se invitaba, la persona aceptaba, y
// a partir de ahí la única forma de revocar era entrar a Supabase a mano. Un permiso que
// se reparte con un botón y se retira con una consulta SQL no se retira nunca.
//
// El modelo de confianza del repo dice que lo que frena a un voluntario no es una revisión
// previa sino que su acceso es REVOCABLE AL INSTANTE. Esto es lo que hacía falta para que
// eso siguiera siendo verdad con el rol nuevo.
// ───────────────────────────────────────────────────────────────────────────

export interface CenterManager {
  user_id: string;
  /** El nombre que la persona eligió. Nunca su correo: ése no sale de `auth.users`. */
  display_name: string | null;
  created_at: string;
}

export interface PendingInvite {
  id: string;
  /** A quién iba dirigida, si se puso. Null = vale quien tenga el enlace. */
  email: string | null;
  expires_at: string;
}

/**
 * Quién gestiona este punto ahora mismo.
 *
 * DOS consultas y no un embed de PostgREST: `center_managers.user_id` y `profiles.user_id`
 * apuntan los dos a `auth.users`, pero NO hay clave foránea entre ellas, así que PostgREST
 * no puede resolver la relación y un `select=…profiles(…)` falla. Los perfiles se piden
 * aparte, con un `in`.
 *
 * El correo no se pide, y no es un olvido: `010_accounts` lo deja fuera de `profiles` a
 * propósito para que el equipo vea «Ana M.» y no la dirección de Ana. Esa línea no se
 * mueve porque ahora haya un rol más.
 */
export async function fetchCenterManagers(
  sb: SupabaseClient,
  locationId: string,
): Promise<CenterManager[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("center_managers")
    .select("user_id,created_at")
    .eq("location_id", locationId)
    .order("created_at", { ascending: true });
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data || data.length === 0) return [];

  const rows = data as unknown as Row[];
  const ids = rows.map((r) => String(r.user_id));
  const { data: perfiles } = await sb
    .from("profiles")
    .select("user_id,display_name")
    .in("user_id", ids);
  const nombres = new Map(
    ((perfiles ?? []) as unknown as Row[]).map((p) => [String(p.user_id), text(p.display_name)]),
  );

  return rows.map((r) => ({
    user_id: String(r.user_id),
    display_name: nombres.get(String(r.user_id)) ?? null,
    created_at: String(r.created_at ?? ""),
  }));
}

/** Las invitaciones que aún no ha aceptado nadie, para poder cancelarlas. */
export async function fetchPendingInvites(
  sb: SupabaseClient,
  locationId: string,
): Promise<PendingInvite[]> {
  if (tablasAusentes) return [];
  const { data, error } = await sb
    .from("center_invites")
    .select("id,email,expires_at")
    .eq("location_id", locationId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (faltaLaTabla(error)) tablasAusentes = true;
  if (error || !data) return [];
  return (data as unknown as Row[]).map((r) => ({
    id: String(r.id),
    email: text(r.email),
    expires_at: String(r.expires_at ?? ""),
  }));
}

/**
 * Retirarle a alguien la gestión de un punto.
 *
 * Borra la fila y nada más: lo que esa persona publicó mientras gestionaba SIGUE ahí. Las
 * campañas y las entregas son de la iniciativa, no de quien las escribió, y hacerlas
 * desaparecer al retirar un acceso borraría la rendición de cuentas de una campaña que ya
 * recibió dinero.
 *
 * El portero es RLS (`center_managers_staff_write`), y por eso esto puede ser un DELETE
 * directo: sólo pasa si quien llama alcanza la emergencia de ese punto.
 */
export async function revokeCenterManager(
  sb: SupabaseClient,
  locationId: string,
  userId: string,
): Promise<void> {
  const { error } = await sb
    .from("center_managers")
    .delete()
    .eq("location_id", locationId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Cancelar una invitación que todavía no se ha usado. */
export async function cancelInvite(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("center_invites").delete().eq("id", id);
  if (error) throw error;
}
