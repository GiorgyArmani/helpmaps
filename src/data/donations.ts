import type { SupabaseClient } from "@supabase/supabase-js";
import type { Donation } from "@/domain/types";

// Reads and writes against `donations`. One column list, like every other data module:
// never `select("*")` on a table whose shape can grow.

const COLUMNS = "id,name,description,social_url,donate_url,donate_info,sort,active,updated_at";

function map(row: Record<string, unknown>): Donation {
  const text = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : null;
  };
  return {
    id: String(row.id),
    name: String(row.name ?? "").trim(),
    description: text(row.description),
    social_url: text(row.social_url),
    donate_url: text(row.donate_url),
    donate_info: text(row.donate_info),
    sort: typeof row.sort === "number" ? row.sort : 0,
    active: row.active !== false,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/**
 * The public directory. A failure returns an empty list rather than throwing: the
 * donations panel is a side channel, and it must never be the reason the map fails to
 * load — including on a deployment where this migration has not been run.
 */
export async function fetchDonations(sb: SupabaseClient): Promise<Donation[]> {
  const { data, error } = await sb
    .from("donations")
    .select(COLUMNS)
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map(map);
}

/** Including deactivated rows — the staff panel has to be able to see what it hid. */
export async function fetchAllDonations(sb: SupabaseClient): Promise<Donation[]> {
  const { data, error } = await sb
    .from("donations")
    .select(COLUMNS)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map(map);
}

export interface DonationDraft {
  id?: string;
  name: string;
  description: string | null;
  social_url: string | null;
  donate_url: string | null;
  donate_info: string | null;
  sort: number;
  active: boolean;
}

/** Staff insert/update; RLS is the gate, not this module. */
export async function saveDonation(sb: SupabaseClient, draft: DonationDraft): Promise<void> {
  const row = {
    name: draft.name,
    description: draft.description,
    social_url: draft.social_url,
    donate_url: draft.donate_url,
    donate_info: draft.donate_info,
    sort: draft.sort,
    active: draft.active,
    updated_at: new Date().toISOString(),
  };
  const { error } = draft.id
    ? await sb.from("donations").update(row).eq("id", draft.id)
    : await sb.from("donations").insert(row);
  if (error) throw error;
}

/** Admin only (RLS). Deactivating is usually the right move; this is for a mistake. */
export async function deleteDonation(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("donations").delete().eq("id", id);
  if (error) throw error;
}
