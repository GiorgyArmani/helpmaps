import { supabasePublic } from "@/lib/supabase/server";
import { fetchCenters } from "@/data/centers";
import { currentEmergencyId } from "@/server/emergency";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { COUNTRY, hasFeature, isKnownRegion, isTypeEnabled } from "@/config";
import { hasNeed, isOpenPoint, lastTouched, statusOf } from "@/domain/center";
import { isLocationType } from "@/domain/types";

/**
 * GET /api/v1/centers — the public read API.
 *
 * Every HelpMaps deployment exposes the same contract, so a partner integrates once and
 * reads any country. Open (no key) and CORS-open by design: the data is meant to travel.
 * The limiter is there so a scraper cannot take the map down for the people who need it.
 *
 * The response shape is explicit, never `select("*")`: a column added to the database
 * must not start flowing to third parties because nobody updated a query.
 *
 * Query: ?region= ?type= ?needs=true ?status=abierto ?limit= ?offset=
 */

export const revalidate = 60;

const MAX_LIMIT = 500;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  // A clone that has not opted into the public API should not quietly serve it anyway.
  if (!hasFeature("publicApi")) return json({ error: "not_found" }, 404);

  const limit = rateLimit(`api-centers:${clientIp(req.headers)}`, 60);
  if (!limit.ok) return tooManyRequests(limit);

  const sb = supabasePublic();
  if (!sb) {
    return json({ error: "not_configured" }, 503);
  }

  const url = new URL(req.url);
  const q = url.searchParams;

  const region = q.get("region");
  if (region && !isKnownRegion(region)) {
    return json({ error: "unknown_region", allowed: COUNTRY.regions.map((r) => r.code) }, 400);
  }

  const type = q.get("type");
  if (type && (!isLocationType(type) || !isTypeEnabled(type))) {
    return json({ error: "unknown_type" }, 400);
  }

  const onlyNeeds = q.get("needs") === "true";
  const status = q.get("status");
  const pageLimit = clampInt(q.get("limit"), 100, 1, MAX_LIMIT);
  const offset = clampInt(q.get("offset"), 0, 0, 100_000);

  let centers;
  try {
    centers = await fetchCenters(sb, await currentEmergencyId());
  } catch {
    return json({ error: "upstream_error" }, 502);
  }

  const filtered = centers.filter((c) => {
    if (region && c.region !== region) return false;
    if (type && c.type !== type) return false;
    if (onlyNeeds && (!hasNeed(c) || !isOpenPoint(c))) return false;
    if (status && statusOf(c) !== status) return false;
    return true;
  });

  const page = filtered.slice(offset, offset + pageLimit);

  return json(
    {
      country: { code: COUNTRY.code, name: COUNTRY.name, slug: COUNTRY.slug },
      count: filtered.length,
      limit: pageLimit,
      offset,
      next:
        offset + pageLimit < filtered.length
          ? `${url.pathname}?${next(q, offset + pageLimit, pageLimit)}`
          : null,
      data: page.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        region: c.region,
        region_name: c.region ? COUNTRY.regions.find((r) => r.code === c.region)?.name ?? null : null,
        municipality: c.municipality,
        lat: c.lat,
        lng: c.lng,
        address: c.address,
        phone: c.phone,
        whatsapp: c.whatsapp,
        status: statusOf(c),
        needs: c.info?.needs ?? null,
        receives: c.info?.receives ?? [],
        help: c.info?.help ?? [],
        category: c.info?.category ?? null,
        schedule: c.info?.schedule ?? null,
        is_animal: c.info?.is_animal ?? false,
        source: c.info?.source ?? null,
        last_confirmed_at: c.info?.last_confirmed_at ?? null,
        updated_at: lastTouched(c),
        url: `https://${COUNTRY.host}/c/${c.id}`,
      })),
    },
    200,
  );
}

function next(params: URLSearchParams, offset: number, limit: number): string {
  const copy = new URLSearchParams(params);
  copy.set("offset", String(offset));
  copy.set("limit", String(limit));
  return copy.toString();
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
