import { COUNTRY } from "@/config";

// Address lookup for the staff form.
//
// Three ways in, tried in this order, because in a disaster the address a caller gives
// you is rarely something a geocoder can resolve:
//
//   1. A pasted Google/Apple Maps link, or raw coordinates. This ALWAYS resolves, which
//      is why it goes first — the fastest reliable path for a volunteer on a phone is to
//      find the place in the Maps app they already use, hit share, and paste it here.
//   2. Nominatim (OpenStreetMap): no key, no quota tier, and it indexes POIs by NAME, so
//      "Hospital San José" works where the street address does not.
//   3. Photon (Komoot): a second free OSM geocoder with fuzzier matching that finds
//      places Nominatim misses. Only consulted when Nominatim returns nothing.
//
// Everything is scoped to this deployment's country box, so "san josé" in Colombia does
// not offer Costa Rica.

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  /** Best-effort administrative names, used to prefill region/municipality. */
  state: string | null;
  municipality: string | null;
}

interface NominatimAddress {
  state?: string;
  region?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
}

/** Inside this deployment's bounding box. Guards every path below. */
function inCountry(lat: number, lng: number): boolean {
  const [[south, west], [north, east]] = COUNTRY.geo.bounds;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= south &&
    lat <= north &&
    lng >= west &&
    lng <= east
  );
}

/**
 * Coordinates out of a pasted maps link, or a bare "lat, lng".
 *
 * The escape hatch that always works. A volunteer who cannot get the geocoder to find a
 * place can open it in Google Maps, copy the link and paste it here — and a link is what
 * people actually forward to each other about a shelter, so this is usually the form the
 * location arrives in anyway.
 *
 * Rejects anything outside the country box: a link someone pasted by mistake would
 * otherwise drop a pin on another continent, and a wrong pin sends people to the wrong
 * place, which is the one failure this whole form exists to prevent.
 */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  if (!text) return null;
  let t = text.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    // Malformed percent-escapes: keep the raw string, the patterns below still work.
  }

  const ok = (lat: number, lng: number) => (inCountry(lat, lng) ? { lat, lng } : null);

  // Google Maps URL forms, most specific first:
  //   .../@4.65,-74.1,17z   ·   !3d4.65!4d-74.1   ·   ?q=4.65,-74.1 / ?ll= / ?daddr=
  // Apple Maps uses ?ll= and ?daddr=, which the third pattern already covers.
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|daddr|destination|center|sll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1] && m[2]) {
      const hit = ok(Number.parseFloat(m[1]), Number.parseFloat(m[2]));
      if (hit) return hit;
    }
  }

  // Bare "lat, lng" or "lat lng". Decimals are required so a street number ("Calle 45
  // 12 30") can never be read as a coordinate pair.
  const bare = t.match(/^\s*(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*$/);
  if (bare?.[1] && bare[2]) return ok(Number.parseFloat(bare[1]), Number.parseFloat(bare[2]));
  return null;
}

function num(v: unknown): number {
  return typeof v === "string" ? Number.parseFloat(v) : Number.NaN;
}

async function nominatim(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const [[south, west], [north, east]] = COUNTRY.geo.bounds;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", COUNTRY.geo.geocodeCountry);
  url.searchParams.set("viewbox", `${west},${north},${east},${south}`);

  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const rows = (await res.json()) as {
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: NominatimAddress;
  }[];

  return rows
    .map((r) => {
      const lat = num(r.lat);
      const lng = num(r.lon);
      if (!inCountry(lat, lng)) return null;
      const a = r.address ?? {};
      return {
        label: r.display_name ?? `${lat}, ${lng}`,
        lat,
        lng,
        state: a.state ?? a.region ?? null,
        municipality: a.city ?? a.town ?? a.municipality ?? a.village ?? a.county ?? null,
      } satisfies GeoResult;
    })
    .filter((r): r is GeoResult => r !== null);
}

async function photon(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const [lat0, lng0] = COUNTRY.geo.center;
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  // Bias toward this country rather than restricting to it: Photon has no country filter,
  // so the box check below does the actual scoping.
  url.searchParams.set("lat", String(lat0));
  url.searchParams.set("lon", String(lng0));

  const res = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const body = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: unknown };
      properties?: Record<string, string>;
    }[];
  };

  return (body.features ?? [])
    .map((f) => {
      const coords = f.geometry?.coordinates;
      if (!Array.isArray(coords)) return null;
      // GeoJSON order is [lng, lat].
      const lng = typeof coords[0] === "number" ? coords[0] : Number.NaN;
      const lat = typeof coords[1] === "number" ? coords[1] : Number.NaN;
      if (!inCountry(lat, lng)) return null;
      const p = f.properties ?? {};
      const label = [p.name, p.street, p.district, p.city, p.state].filter(Boolean).join(", ");
      return {
        label: label || p.name || q,
        lat,
        lng,
        state: p.state ?? null,
        // Photon uses OSM keys; remap to what the form's prefill expects.
        municipality: p.city ?? p.county ?? p.district ?? null,
      } satisfies GeoResult;
    })
    .filter((r): r is GeoResult => r !== null);
}

export interface GeoOptions {
  /** Narrows the first attempts. Dropped progressively if they find nothing. */
  municipality?: string;
  regionName?: string;
  signal?: AbortSignal;
}

/**
 * Candidates for a place, best first. Never throws — a geocoder being down must not stop
 * someone publishing a shelter, since the coordinates can always be pasted instead.
 *
 * Several candidates are returned rather than one auto-applied answer: the admin picks,
 * then verifies the pin. That is the whole point of the warning next to this field.
 */
export async function geocode(query: string, opts: GeoOptions = {}): Promise<GeoResult[]> {
  const term = query.trim();
  if (!term) return [];

  // 1. A pasted link or raw coordinates wins outright — it is not a guess.
  const exact = parseLatLng(term);
  if (exact) {
    return [{ label: `${exact.lat.toFixed(6)}, ${exact.lng.toFixed(6)}`, ...exact, state: null, municipality: null }];
  }

  if (term.length < 3) return [];

  // 2. Most specific query first, then progressively drop the location bias. Nominatim
  //    matches POI names strictly: an extra token that is not part of the OSM name can
  //    take an otherwise-good match to zero hits, so stop at the first query that
  //    answers. `countrycodes` already scopes the search, so the country is never added.
  const attempts = [
    [term, opts.municipality, opts.regionName],
    [term, opts.regionName],
    [term],
  ]
    .map((parts) => parts.filter(Boolean).join(" ").trim())
    .filter((q, i, all) => q && all.indexOf(q) === i);

  for (const q of attempts) {
    try {
      const hits = await nominatim(q, opts.signal);
      if (hits.length > 0) return hits;
    } catch {
      break; // network down or aborted: stop retrying, try the other provider
    }
  }

  // 3. Nominatim knows nothing about it. Photon often does.
  try {
    return await photon(attempts[0] ?? term, opts.signal);
  } catch {
    return [];
  }
}

/**
 * Map a free-text administrative name to one of this country's region codes.
 *
 * Deliberately conservative: it strips the usual prefixes ("Departamento de",
 * "Estado"), normalises accents, and returns null when it is not sure. A wrong region
 * only mis-files a point in the filter, but silently guessing would hide that it needs
 * a human to look.
 */
export function matchRegion(name: string | null | undefined): string | null {
  if (!name) return null;
  const norm = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/^(departamento|estado|provincia|edo\.?|dpto\.?)\s+(de\s+|del\s+)?/i, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const target = norm(name);
  if (!target) return null;
  const hit = COUNTRY.regions.find((r) => norm(r.name) === target);
  return hit?.code ?? null;
}
