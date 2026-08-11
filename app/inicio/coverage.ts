import { unstable_cache } from "next/cache";
import { COUNTRY } from "@/config";
import { supabasePublic } from "@/lib/supabase/server";
import type { LocationType } from "@/domain/types";
import { isLocationType } from "@/domain/types";

/**
 * How many points of each type are published right now.
 *
 * Read from the database rather than written into the page: the registry grows daily,
 * and a number typed into a landing page is stale the week after it ships. `locations`
 * is public and anon-readable, and this only counts rows — no personal data is involved,
 * which is why it can run without a session.
 *
 * Cached for 30 minutes across requests. The entry page itself renders dynamically (it
 * reads `?lang=`), so without this every visitor would cost a database round trip on a
 * page that is identical for all of them. The registry changes daily, not per minute.
 *
 * Returns null on any failure. The entry page must never fail to render because a count
 * query timed out — it simply omits the strip.
 */
export type Coverage = Partial<Record<LocationType, number>>;

async function queryCoverage(): Promise<Coverage | null> {
  const sb = supabasePublic();
  if (!sb) return null;
  try {
    // One round trip: a few hundred single-column rows costs less than a count query per
    // type, and tallying them here is free.
    const { data, error } = await sb.from("locations").select("type").eq("active", true);
    if (error || !data) return null;
    const out: Coverage = {};
    for (const row of data as { type: unknown }[]) {
      if (!isLocationType(row.type)) continue;
      out[row.type] = (out[row.type] ?? 0) + 1;
    }
    return out;
  } catch {
    return null;
  }
}

// Keyed by country so two clones sharing a build cache never read each other's counts.
export const fetchCoverage = unstable_cache(queryCoverage, ["entry-coverage", COUNTRY.slug], {
  revalidate: 1800,
});
