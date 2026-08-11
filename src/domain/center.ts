import type { Center, CenterInfo, CenterStatus, Location, LocationType } from "@/domain/types";
import { helpKinds, isLocationType, toCenterStatus } from "@/domain/types";
import { MAPCFG } from "@/config";

// Everything the app decides ABOUT a point lives here: no component re-implements
// "is this stale", "is this asking for help", "does this match the search".

type Row = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function mapCenterInfo(row: Row | null | undefined): CenterInfo | null {
  if (!row) return null;
  const id = str(row.location_id);
  if (!id) return null;
  return {
    location_id: id,
    status: toCenterStatus(row.status),
    receives: strArray(row.receives),
    needs: str(row.needs),
    help: helpKinds(strArray(row.help)),
    category: str(row.category),
    description: str(row.description),
    schedule: str(row.schedule),
    contact_name: str(row.contact_name),
    social_url: str(row.social_url),
    is_animal: row.is_animal === true,
    last_confirmed_at: str(row.last_confirmed_at),
    updated_at: str(row.updated_at),
    source: str(row.source),
    external_id: str(row.external_id),
  };
}

/**
 * Map a `locations` row (optionally with an embedded `center_info`) to a Center.
 *
 * PostgREST returns an embedded 1:1 child as an object, but as an array when it cannot
 * prove uniqueness. Both shapes are accepted so a schema tweak never blanks the needs
 * card silently.
 */
export function mapCenter(row: Row): Center | null {
  const id = str(row.id);
  const name = str(row.name);
  const lat = num(row.lat);
  const lng = num(row.lng);
  const type = isLocationType(row.type) ? row.type : null;
  if (!id || !name || lat === null || lng === null || !type) return null;

  const rawInfo = row.info ?? row.center_info;
  const infoRow = Array.isArray(rawInfo) ? (rawInfo[0] as Row | undefined) : (rawInfo as Row | null);

  const location: Location = {
    id,
    name,
    type,
    region: str(row.region),
    municipality: str(row.municipality),
    lat,
    lng,
    address: str(row.address),
    phone: str(row.phone),
    whatsapp: str(row.whatsapp),
    active: row.active !== false,
    updated_at: str(row.updated_at),
  };

  return { ...location, info: mapCenterInfo(infoRow) };
}

export function mapCenters(rows: Row[] | null | undefined): Center[] {
  if (!rows) return [];
  return rows.map(mapCenter).filter((c): c is Center => c !== null);
}

// ---------------------------------------------------------------------------
// Freshness and status
// ---------------------------------------------------------------------------

/** Most recent moment a human touched this point's information. */
export function lastTouched(center: Center): string | null {
  return center.info?.last_confirmed_at ?? center.info?.updated_at ?? center.updated_at;
}

export function daysSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

/**
 * A point nobody has confirmed in a while. A three-week-old "needs water" is a guess,
 * not information — so the UI asks people to call before travelling rather than
 * pretending the line is current.
 */
export function isStale(center: Center, now: number = Date.now()): boolean {
  const d = daysSince(lastTouched(center), now);
  return d !== null && d >= MAPCFG.staleAfterDays;
}

export function statusOf(center: Center): CenterStatus | null {
  return center.info?.status ?? null;
}

/**
 * Is this point still worth sending someone to? `null` (unknown) counts as open: most
 * rows have never been given a status, and hiding all of them would empty the map.
 * `cerrado` is the only value that removes a point from the "needs help" surfaces.
 */
export function isOpenPoint(center: Center): boolean {
  return statusOf(center) !== "cerrado";
}

/** Does this point currently ask for something? Drives the needs bar and list. */
export function hasNeed(center: Center): boolean {
  const info = center.info;
  if (!info) return false;
  return Boolean(info.needs?.trim()) || info.help.length > 0;
}

/** Points asking for help right now, needs-first, excluding closed ones. */
export function pointsNeedingHelp(centers: Center[]): Center[] {
  return centers.filter((c) => c.active && isOpenPoint(c) && hasNeed(c));
}

// ---------------------------------------------------------------------------
// Search and filtering
// ---------------------------------------------------------------------------

/** Accent- and case-insensitive: "bogota" must find "Bogotá". */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesQuery(center: Center, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = [
    center.name,
    center.municipality ?? "",
    center.address ?? "",
    center.info?.category ?? "",
    center.info?.needs ?? "",
  ]
    .map(normalize)
    .join(" ");
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export interface CenterFilter {
  query: string;
  region: string | null;
  types: LocationType[];
  /** Only points that are asking for something. */
  onlyNeeds: boolean;
}

export const EMPTY_FILTER: CenterFilter = {
  query: "",
  region: null,
  types: [],
  onlyNeeds: false,
};

export function filterCenters(centers: Center[], f: CenterFilter): Center[] {
  return centers.filter((c) => {
    if (!c.active) return false;
    if (f.types.length > 0 && !f.types.includes(c.type)) return false;
    if (f.region && c.region !== f.region) return false;
    if (f.onlyNeeds && !hasNeed(c)) return false;
    return matchesQuery(c, f.query);
  });
}

// ---------------------------------------------------------------------------
// Geo
// ---------------------------------------------------------------------------

/** Great-circle distance in km. Used to sort by "closest to me", never to place a pin. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Directions link that works on both phones and desktop, no app required. */
export function directionsUrl(center: Pick<Center, "lat" | "lng" | "name">): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`;
}
