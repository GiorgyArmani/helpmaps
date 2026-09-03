import type { SupabaseClient } from "@supabase/supabase-js";
import type { Center, CenterStatus, HelpKind, LocationType } from "@/domain/types";
import { mapCenter, mapCenters } from "@/domain/center";

// All reads and writes against `locations` + `center_info` go through this module, so
// the column list lives in exactly one place. Never `select("*")` on a table whose shape
// can grow: an added column would start flowing to the client without anyone deciding it.

const LOCATION_COLUMNS =
  "id,name,type,region,municipality,lat,lng,address,phone,whatsapp,active,updated_at," +
  "coverage_regions,coverage_municipalities";

const INFO_COLUMNS =
  "location_id,status,receives,needs,help,category,description,schedule,contact_name," +
  "social_url,website,instagram,is_animal,last_confirmed_at,updated_at,source,external_id";

const SELECT = `${LOCATION_COLUMNS},info:center_info(${INFO_COLUMNS})`;

// ── Before `011_digitales` ─────────────────────────────────────────────────
//
// One repository serves several countries, each on its own database, and they do not
// all run a migration the same afternoon. A deploy that asks for `coverage_regions` on a
// database that does not have it yet would get Postgres error 42703 back — and an EMPTY
// MAP, during an emergency, for a column nobody there has heard of.
//
// So every read tries the full column list and, on that one error, falls back to the
// list from before the migration. The mapper already treats the missing columns as
// "no coverage, no links". The fallback is logged so the gap is visible, not silent.
const LEGACY_LOCATION_COLUMNS =
  "id,name,type,region,municipality,lat,lng,address,phone,whatsapp,active,updated_at";
const LEGACY_INFO_COLUMNS =
  "location_id,status,receives,needs,help,category,description,schedule,contact_name," +
  "social_url,is_animal,last_confirmed_at,updated_at,source,external_id";
const LEGACY_SELECT = `${LEGACY_LOCATION_COLUMNS},info:center_info(${LEGACY_INFO_COLUMNS})`;

/** Postgres `undefined_column`, as PostgREST relays it. */
function isMissingColumn(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "42703");
}

let warnedLegacy = false;
function warnLegacy(): void {
  if (warnedLegacy) return;
  warnedLegacy = true;
  console.warn("[centers] esta base no tiene la sección 011_digitales: corre db/04_digitales.sql");
}

/**
 * Narrow a query to one emergency.
 *
 * `null` means "do not scope", which is the correct behaviour for a deployment that has
 * not adopted `db/01_esquema.sql § 007_emergencies`: there is one implicit emergency and every row
 * belongs to it.
 *
 * When there IS an id, rows with `emergency_id is null` are included alongside it. That is
 * not laxity, it is the failure mode being chosen deliberately: a country that runs the
 * migration and creates its row without running the backfill would otherwise open to an
 * EMPTY MAP. An unassigned row showing up in the only emergency that exists is a
 * cosmetic problem; a blank map during an earthquake is not. The backfill snippet at the
 * end of `db/01_esquema.sql § 008_tenancy` is what makes the distinction exact, and running a second
 * emergency in one database requires it.
 */
function scopeTo<T extends { or: (f: string) => T }>(query: T, emergencyId: string | null): T {
  if (!emergencyId) return query;
  return query.or(`emergency_id.eq.${emergencyId},emergency_id.is.null`);
}

/** Every active point with its needs. One request: the map needs them all at once. */
export async function fetchCenters(
  sb: SupabaseClient,
  emergencyId: string | null = null,
): Promise<Center[]> {
  const run = (columns: string) =>
    scopeTo(sb.from("locations").select(columns).eq("active", true), emergencyId).order("name", {
      ascending: true,
    });
  let { data, error } = await run(SELECT);
  if (error && isMissingColumn(error)) {
    warnLegacy();
    ({ data, error } = await run(LEGACY_SELECT));
  }
  if (error) throw error;
  return mapCenters(data as unknown as Record<string, unknown>[]);
}

/** Including inactive rows — the staff panel must be able to see what it hid. */
export async function fetchAllCenters(
  sb: SupabaseClient,
  emergencyId: string | null = null,
): Promise<Center[]> {
  const run = (columns: string) =>
    scopeTo(sb.from("locations").select(columns), emergencyId).order("updated_at", {
      ascending: false,
    });
  let { data, error } = await run(SELECT);
  if (error && isMissingColumn(error)) {
    warnLegacy();
    ({ data, error } = await run(LEGACY_SELECT));
  }
  if (error) throw error;
  return mapCenters(data as unknown as Record<string, unknown>[]);
}

/**
 * One point by id.
 *
 * Scoped like the others so a shared link cannot render another emergency's point inside
 * this one's branding and legal notice — the id is unique, but the page around it is not.
 */
export async function fetchCenter(
  sb: SupabaseClient,
  id: string,
  emergencyId: string | null = null,
): Promise<Center | null> {
  const run = (columns: string) =>
    scopeTo(sb.from("locations").select(columns).eq("id", id), emergencyId).maybeSingle();
  let { data, error } = await run(SELECT);
  if (error && isMissingColumn(error)) {
    warnLegacy();
    ({ data, error } = await run(LEGACY_SELECT));
  }
  if (error) throw error;
  if (!data) return null;
  return mapCenter(data as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Writes (staff only — enforced by RLS, not by this module)
// ---------------------------------------------------------------------------

export interface CenterDraft {
  id: string;
  name: string;
  type: LocationType;
  region: string | null;
  municipality: string | null;
  /** Null only for `digital`; the database rejects it for any other type. */
  lat: number | null;
  lng: number | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  active: boolean;
  /** Region codes a digital initiative serves (empty = whole country). `[]` otherwise. */
  coverage_regions: string[];
  coverage_municipalities: string[];
  info: {
    status: CenterStatus | null;
    receives: string[];
    needs: string | null;
    help: HelpKind[];
    category: string | null;
    description: string | null;
    schedule: string | null;
    contact_name: string | null;
    social_url: string | null;
    website: string | null;
    instagram: string | null;
    is_animal: boolean;
  };
}

/** Slug for a new point: readable in URLs and in the audit log, unique enough in practice. */
export function makeCenterId(name: string, type: LocationType): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${type.slice(0, 3)}_${base || "punto"}_${suffix}`;
}

/**
 * Upsert a point and its needs.
 *
 * `last_confirmed_at` is stamped whenever the status is set to something: saying a point
 * is open IS a confirmation, and that timestamp is what the freshness warning reads.
 */
export async function saveCenter(
  sb: SupabaseClient,
  draft: CenterDraft,
  opts: { statusChanged: boolean; emergencyId?: string | null },
): Promise<void> {
  const location = {
    id: draft.id,
    // Stamped on every write, so a point created today is assigned even where the legacy
    // rows never were. Omitted entirely when there is no emergency, rather than written
    // as null: an explicit null would overwrite a good value on a deployment that has
    // adopted the table and is saving from an unmigrated call site.
    ...(opts.emergencyId ? { emergency_id: opts.emergencyId } : {}),
    name: draft.name,
    type: draft.type,
    region: draft.region,
    municipality: draft.municipality,
    lat: draft.lat,
    lng: draft.lng,
    address: draft.address,
    phone: draft.phone,
    whatsapp: draft.whatsapp,
    active: draft.active,
  };
  const digitalColumns = {
    coverage_regions: draft.coverage_regions,
    coverage_municipalities: draft.coverage_municipalities,
  };
  let { error: locError } = await sb
    .from("locations")
    .upsert({ ...location, ...digitalColumns }, { onConflict: "id" });
  // Same fallback as the reads: a database without `011_digitales` can still save a
  // place. A digital initiative cannot be saved there — it IS those columns.
  if (locError && isMissingColumn(locError)) {
    warnLegacy();
    if (draft.type === "digital") throw locError;
    ({ error: locError } = await sb.from("locations").upsert(location, { onConflict: "id" }));
  }
  if (locError) throw locError;

  const info: Record<string, unknown> = {
    location_id: draft.id,
    status: draft.info.status,
    receives: draft.info.receives,
    needs: draft.info.needs,
    help: draft.info.help,
    category: draft.info.category,
    description: draft.info.description,
    schedule: draft.info.schedule,
    contact_name: draft.info.contact_name,
    social_url: draft.info.social_url,
    website: draft.info.website,
    instagram: draft.info.instagram,
    is_animal: draft.info.is_animal,
    updated_at: new Date().toISOString(),
  };
  if (opts.statusChanged && draft.info.status) {
    info.last_confirmed_at = new Date().toISOString();
  }

  let { error: infoError } = await sb
    .from("center_info")
    .upsert(info, { onConflict: "location_id" });
  if (infoError && isMissingColumn(infoError)) {
    warnLegacy();
    const legacyInfo = { ...info };
    delete legacyInfo.website;
    delete legacyInfo.instagram;
    ({ error: infoError } = await sb
      .from("center_info")
      .upsert(legacyInfo, { onConflict: "location_id" }));
  }
  if (infoError) throw infoError;
}

/**
 * Delete a point. Admin-only at the RLS layer, and deliberately so: the delete cascades
 * to its needs row, and a point vanishing from the map is indistinguishable, to a family
 * looking for it, from the place having closed.
 */
export async function deleteCenter(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("locations").delete().eq("id", id);
  if (error) throw error;
}

/** One-tap "still open" from the staff list, without opening the whole form. */
export async function confirmCenterOpen(sb: SupabaseClient, id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await sb
    .from("center_info")
    .upsert(
      { location_id: id, status: "abierto", last_confirmed_at: now, updated_at: now },
      { onConflict: "location_id" },
    );
  if (error) throw error;
}

/**
 * "Ya cerró", en un toque, desde la cola de avisos.
 *
 * Gemela de `confirmCenterOpen` y por el mismo motivo: sella `last_confirmed_at` junto con
 * el estado. Un punto marcado como cerrado sin fecha se lee como un cierre de hace meses y
 * la gente lo ignora; con fecha de hoy, se lee como lo que es — alguien acaba de comprobar
 * que esa puerta está cerrada, que es información tan útil como la contraria.
 */
export async function closeCenter(sb: SupabaseClient, id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await sb
    .from("center_info")
    .upsert(
      { location_id: id, status: "cerrado", last_confirmed_at: now, updated_at: now },
      { onConflict: "location_id" },
    );
  if (error) throw error;
}
