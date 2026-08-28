import type { SupabaseClient } from "@supabase/supabase-js";
import type { Center, CenterStatus, HelpKind, LocationType } from "@/domain/types";
import { mapCenter, mapCenters } from "@/domain/center";

// All reads and writes against `locations` + `center_info` go through this module, so
// the column list lives in exactly one place. Never `select("*")` on a table whose shape
// can grow: an added column would start flowing to the client without anyone deciding it.

const LOCATION_COLUMNS =
  "id,name,type,region,municipality,lat,lng,address,phone,whatsapp,active,updated_at";

const INFO_COLUMNS =
  "location_id,status,receives,needs,help,category,description,schedule,contact_name," +
  "social_url,is_animal,last_confirmed_at,updated_at,source,external_id";

const SELECT = `${LOCATION_COLUMNS},info:center_info(${INFO_COLUMNS})`;

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
  const { data, error } = await scopeTo(
    sb.from("locations").select(SELECT).eq("active", true),
    emergencyId,
  ).order("name", { ascending: true });
  if (error) throw error;
  return mapCenters(data as unknown as Record<string, unknown>[]);
}

/** Including inactive rows — the staff panel must be able to see what it hid. */
export async function fetchAllCenters(
  sb: SupabaseClient,
  emergencyId: string | null = null,
): Promise<Center[]> {
  const { data, error } = await scopeTo(
    sb.from("locations").select(SELECT),
    emergencyId,
  ).order("updated_at", { ascending: false });
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
  const { data, error } = await scopeTo(
    sb.from("locations").select(SELECT).eq("id", id),
    emergencyId,
  ).maybeSingle();
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
  lat: number;
  lng: number;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  active: boolean;
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
  const { error: locError } = await sb.from("locations").upsert(
    {
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
    },
    { onConflict: "id" },
  );
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
    is_animal: draft.info.is_animal,
    updated_at: new Date().toISOString(),
  };
  if (opts.statusChanged && draft.info.status) {
    info.last_confirmed_at = new Date().toISOString();
  }

  const { error: infoError } = await sb
    .from("center_info")
    .upsert(info, { onConflict: "location_id" });
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
