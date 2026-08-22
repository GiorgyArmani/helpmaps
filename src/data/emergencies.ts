import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmergencyRow } from "@/config/fromRow";

// Reads and writes the registry. The gate is RLS: `emergencies_staff_read` lets any staff
// member see the list, `emergencies_super_write` lets only a superadmin change it, and
// `emergencies_admin_notice` lets an admin change the operating state of their own. This
// module asks; the database decides.

const COLUMNS =
  "id,slug,host,country_code,country_name,name,hazard_type,status," +
  "region_noun,geo,regions,legal,brand,features,language,hazard,layers,news,maintenance,notice";

/** Every emergency in this database, drafts included. One row on a country deployment. */
export async function fetchEmergencies(sb: SupabaseClient): Promise<EmergencyRow[]> {
  const { data, error } = await sb
    .from("emergencies")
    .select(COLUMNS)
    .order("status", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as EmergencyRow[];
}

/**
 * What the form edits. `id` absent means a new row.
 *
 * The nested blocks are typed as the shapes `src/config/types.ts` already defines, because
 * this row IS that object — the console is editing a `CountryConfig`, not a lookalike.
 */
export type EmergencyDraft = Omit<EmergencyRow, "id"> & { id?: string };

export async function saveEmergency(sb: SupabaseClient, draft: EmergencyDraft): Promise<void> {
  const row: Record<string, unknown> = {
    slug: draft.slug,
    // An empty host is stored as NULL, not as "": the unique index has to let several
    // emergencies sit hostless at once, and two empty strings would collide.
    host: draft.host?.trim() ? draft.host.trim() : null,
    country_code: draft.country_code.toUpperCase(),
    country_name: draft.country_name,
    name: draft.name,
    hazard_type: draft.hazard_type,
    status: draft.status,
    region_noun: draft.region_noun,
    geo: draft.geo,
    regions: draft.regions,
    legal: draft.legal,
    brand: draft.brand,
    features: draft.features,
    language: draft.language,
    hazard: draft.hazard,
    layers: draft.layers,
    news: draft.news,
    maintenance: draft.maintenance,
    notice: draft.notice?.trim() ? draft.notice.trim() : null,
  };
  if (draft.id) row.id = draft.id;

  // Conflict on `slug` rather than `id` so re-saving an emergency that was created
  // elsewhere updates it instead of failing on the unique index.
  const { error } = await sb.from("emergencies").upsert(row, { onConflict: "slug" });
  if (error) throw error;
}

/**
 * Move an emergency between draft, active and archived.
 *
 * Archiving rather than deleting is the whole reason `status` exists: `locations` points at
 * `emergencies` with `on delete restrict`, so an emergency that ever published a point
 * cannot be removed without taking the map's history with it.
 */
export async function setEmergencyStatus(
  sb: SupabaseClient,
  id: string,
  status: EmergencyRow["status"],
): Promise<void> {
  const { error } = await sb.from("emergencies").update({ status }).eq("id", id);
  if (error) throw error;
}

/** The maintenance banner for one emergency. Admins of that emergency may set it too. */
export async function setEmergencyNotice(
  sb: SupabaseClient,
  id: string,
  patch: { maintenance?: boolean; notice?: string | null },
): Promise<void> {
  const { error } = await sb.from("emergencies").update(patch).eq("id", id);
  if (error) throw error;
}

/** How many points each emergency has — so the console can warn before archiving one. */
export async function fetchEmergencyPointCounts(
  sb: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await sb.from("locations").select("emergency_id");
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { emergency_id: string | null }[]) {
    const key = row.emergency_id ?? "";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
