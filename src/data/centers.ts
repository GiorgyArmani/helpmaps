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

/** Every active point with its needs. One request: the map needs them all at once. */
export async function fetchCenters(sb: SupabaseClient): Promise<Center[]> {
  const { data, error } = await sb
    .from("locations")
    .select(SELECT)
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return mapCenters(data as unknown as Record<string, unknown>[]);
}

/** Including inactive rows — the staff panel must be able to see what it hid. */
export async function fetchAllCenters(sb: SupabaseClient): Promise<Center[]> {
  const { data, error } = await sb
    .from("locations")
    .select(SELECT)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return mapCenters(data as unknown as Record<string, unknown>[]);
}

export async function fetchCenter(sb: SupabaseClient, id: string): Promise<Center | null> {
  const { data, error } = await sb.from("locations").select(SELECT).eq("id", id).maybeSingle();
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
  opts: { statusChanged: boolean },
): Promise<void> {
  const { error: locError } = await sb.from("locations").upsert(
    {
      id: draft.id,
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
