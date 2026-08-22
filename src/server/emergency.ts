import "server-only";
import { headers } from "next/headers";
import { supabasePublic } from "@/lib/supabase/server";
import { SITE } from "@/config";
import { validateConfig } from "@/config/validate";
import { emergencyFromRow, type EmergencyRow, type ResolvedEmergency } from "@/config/fromRow";
import type { SiteConfig } from "@/config/types";

/**
 * Resolving which emergency this request is for.
 *
 * ── THE FALLBACK IS THE POINT ───────────────────────────────────────────────
 *
 * Everything here is written so that a deployment which has NOT adopted the emergencies
 * table behaves exactly as it did before `db/007_emergencies.sql`: no matching row, no
 * table, no database configured at all — the compiled preset wins and nothing changes.
 * That is what makes this branch safe to merge without migrating anything.
 *
 * ── WHY THIS ONE DOES NOT THROW ─────────────────────────────────────────────
 *
 * `validateConfig` throws on the server, deliberately: a half-filled preset has to break
 * the build of whoever deploys it rather than wait for the first person to open the map.
 * That reasoning does not carry over to a row. A row is edited at runtime by a superadmin
 * and there is no build to break — so a bad one would take the map down for everyone in
 * that country, live, in the middle of an emergency.
 *
 * So here a row that fails validation is logged loudly and DROPPED, and the request falls
 * back to the preset. A slightly stale country is recoverable; a blank screen for someone
 * looking for a shelter is not.
 */

const COLUMNS =
  "id,slug,host,country_code,country_name,name,hazard_type,status," +
  "region_noun,geo,regions,legal,brand,features,language,hazard,layers,news,maintenance,notice";

/**
 * In-memory, per-host, short-lived.
 *
 * This deployment is a long-lived Node process, so the cache actually holds; on a platform
 * that spins up an isolate per request it degrades to one lookup per request, which is
 * correct but slower. Sixty seconds is short enough that a superadmin editing an emergency
 * sees the change while they are still looking at it.
 *
 * Misses are cached too. Without that, a deployment with no rows at all — the normal
 * single-country case — would query the database on every single request to be told the
 * same "no" forever.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: ResolvedEmergency | null }>();

function cached(key: string): { hit: boolean; value: ResolvedEmergency | null } {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < TTL_MS) return { hit: true, value: entry.value };
  return { hit: false, value: null };
}

function remember(key: string, value: ResolvedEmergency | null): ResolvedEmergency | null {
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Drops every cached entry. For the panel to call after writing an emergency. */
export function forgetEmergencies(): void {
  cache.clear();
}

/**
 * The host this request arrived on, without port, lowercased.
 *
 * `x-forwarded-host` first because behind a proxy that is the name the visitor typed;
 * `host` is whatever the proxy dialled internally, which is usually 127.0.0.1.
 */
async function requestHost(): Promise<string | null> {
  try {
    const h = await headers();
    const raw = h.get("x-forwarded-host") ?? h.get("host");
    return raw ? raw.split(":")[0]?.trim().toLowerCase() ?? null : null;
  } catch {
    // Called outside a request scope (a build-time render, a script). No host, no row.
    return null;
  }
}

async function fetchBy(column: "host" | "slug", value: string): Promise<ResolvedEmergency | null> {
  const sb = supabasePublic();
  if (!sb) return null;

  const { data, error } = await sb
    .from("emergencies")
    .select(COLUMNS)
    .eq(column, value)
    .neq("status", "draft")
    .maybeSingle();

  // A missing table is the expected state on a deployment that has not run the migration,
  // so it is not worth a line in the log on every request. Anything else is.
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error(`[emergency] lookup by ${column}="${value}" failed:`, error.message);
    }
    return null;
  }
  if (!data) return null;

  const resolved = emergencyFromRow(data as unknown as EmergencyRow);

  try {
    validateConfig(resolved.site);
  } catch (err) {
    console.error(
      `[emergency] row "${resolved.slug}" is not a usable configuration, falling back to ` +
        `the compiled preset:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  return resolved;
}

/**
 * The single active emergency, when the deployment has exactly one.
 *
 * Asks for two rows precisely so "exactly one" can be told apart from "the first of
 * several" — a `limit(1)` would have made a multi-emergency database silently pick one.
 */
async function fetchSoleActive(): Promise<ResolvedEmergency | null> {
  const sb = supabasePublic();
  if (!sb) return null;

  const { data, error } = await sb
    .from("emergencies")
    .select(COLUMNS)
    .eq("status", "active")
    .limit(2);

  if (error || !data || data.length !== 1) return null;

  const resolved = emergencyFromRow(data[0] as unknown as EmergencyRow);
  try {
    validateConfig(resolved.site);
  } catch {
    return null;
  }
  return resolved;
}

/**
 * The emergency for this request, or null when the preset should be used.
 *
 * `HELPMAPS_EMERGENCY` forces a slug regardless of host. It exists for local development
 * and for previewing an emergency that has no domain pointed at it yet — which is every
 * emergency, right up until the moment it is announced.
 */
export async function currentEmergency(): Promise<ResolvedEmergency | null> {
  const forced = process.env.HELPMAPS_EMERGENCY?.trim();
  if (forced) {
    const key = `slug:${forced}`;
    const c = cached(key);
    return c.hit ? c.value : remember(key, await fetchBy("slug", forced));
  }

  const host = await requestHost();
  const key = `host:${host ?? "-"}`;
  const c = cached(key);
  if (c.hit) return c.value;

  const byHost = host ? await fetchBy("host", host) : null;
  if (byHost) return remember(key, byHost);

  // No row claims this host. On a deployment that serves ONE emergency — the whole model
  // this project is built on — that is a stray domain, an IP address, or a `host` header
  // the proxy rewrote, and the right answer is still that emergency.
  //
  // Without this the request falls through unscoped, and unscoped means every row in the
  // database. In a country database with one emergency that is harmless; in one that has
  // hosted two over time it renders the old event's points under the current event's
  // branding and legal notice, which is worse than either alone.
  //
  // Only when there is EXACTLY one active emergency. With several, guessing which one a
  // visitor meant is not something this layer can do, so it declines and lets the compiled
  // preset answer.
  return remember(key, await fetchSoleActive());
}

/**
 * The configuration this request renders from: the emergency's, or the compiled preset.
 *
 * Server components and route handlers call this instead of importing `SITE` directly.
 * Both return the same shape, so a call site migrates without changing what it says.
 */
export async function getSite(): Promise<SiteConfig> {
  return (await currentEmergency())?.site ?? SITE;
}

/**
 * The id to scope data queries by, or null to leave them unscoped.
 *
 * Null is the correct answer on a deployment that has not adopted the table: there is one
 * implicit emergency and every row belongs to it.
 */
export async function currentEmergencyId(): Promise<string | null> {
  return (await currentEmergency())?.id ?? null;
}
