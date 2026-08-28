/**
 * Cuentas de persona: quién es alguien para esta aplicación, sin decir su correo.
 *
 * ── LA LÍNEA DE PRIVACIDAD ──────────────────────────────────────────────────
 *
 * El corte no es "admin contra público". Es "admin contra TODO EL RESTO", y los
 * voluntarios caen del lado de todo el resto.
 *
 * El correo de una persona vive en `auth.users` y nunca se copia a una tabla pública.
 * `db/01_esquema.sql § 010_accounts` no tiene una sola política que lo exponga, así que llegar a él
 * exige el service role, que sólo se usa detrás de `requireAdmin()`. Un voluntario que
 * revisa la cola ve `display_name` — "Ana M." — y no puede llegar a la dirección de Ana
 * ni consultando la base directamente con su propia sesión.
 *
 * Por eso `Profile` no tiene campo `email` y no debe tenerlo. Si algún día hace falta
 * mostrarlo, se pide por una ruta con `requireAdmin()` y se devuelve suelto; agregarlo
 * acá lo pondría al alcance de cualquier consulta que ya tenga un perfil en la mano.
 */

/** Quién es una cuenta. Sin correo, a propósito: ver la nota de arriba. */
export interface Profile {
  userId: string;
  /** Lo único que otra persona del equipo llega a ver. Puede ser un apodo. */
  displayName: string;
  /** Estado, opcional. Nunca una dirección. */
  region: string | null;
  createdAt: string;
}

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

/**
 * ¿Sirve este nombre para mostrar?
 *
 * Deliberadamente permisivo: no se valida como nombre real. Quien prefiera un apodo tiene
 * que poder usarlo, y en el país donde corre esto esa preferencia puede no ser un
 * capricho. Lo único que se rechaza es lo que rompería una lista — vacío, demasiado
 * largo, o caracteres de control invisibles.
 *
 * El chequeo va por punto de código y no por expresión regular: un rango de caracteres
 * de control escrito como literal es invisible en el propio archivo, y ya se coló una vez
 * en este mismo módulo sin que se notara al leerlo.
 */
export function displayNameInvalid(value: unknown): boolean {
  if (typeof value !== "string") return true;
  const v = value.trim();
  if (v.length < DISPLAY_NAME_MIN || v.length > DISPLAY_NAME_MAX) return true;
  for (const ch of v) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Colapsa espacios y recorta. Lo que se guarda, no lo que se valida. */
export function cleanDisplayName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

// ---------------------------------------------------------------------------
// Reportes sobre un punto
// ---------------------------------------------------------------------------

/**
 * Qué puede decir alguien con cuenta sobre un punto del mapa.
 *
 * Tres opciones y no un campo libre: la cola del panel tiene que poder agruparse por
 * "cuánta gente dice lo mismo", y eso no se hace con prosa. La nota existe para el
 * matiz, no para el dato.
 *
 * Un reporte NO confirma nada por sí solo: `center_info` sólo lo escribe el equipo, y lo
 * que hace un reporte es subir el punto en la cola para que alguien verificado lo mire.
 * El porqué está en `db/01_esquema.sql § 010_accounts` § 4.
 */
export type ReportKind = "sigue_abierto" | "ya_cerro" | "dato_incorrecto";

export const REPORT_KINDS: ReportKind[] = ["sigue_abierto", "ya_cerro", "dato_incorrecto"];

export function isReportKind(value: unknown): value is ReportKind {
  return typeof value === "string" && (REPORT_KINDS as string[]).includes(value);
}

export type ReportStatus = "pending" | "applied" | "dismissed";

export interface PointReport {
  id: string;
  locationId: string;
  userId: string;
  kind: ReportKind;
  note: string | null;
  status: ReportStatus;
  createdAt: string;
}

/** Cuánta gente dice cada cosa sobre un punto. Ordena la cola del panel. */
export interface ReportCounts {
  locationId: string;
  sigueAbierto: number;
  yaCerro: number;
  datoIncorrecto: number;
  ultimo: string | null;
}
