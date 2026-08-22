import { SEISMIC } from "@/config";
import type { SeismicConfig, SiteConfig } from "@/config/types";

/**
 * La configuración sísmica de ESTE request, no la compilada.
 *
 * Se pasa por parámetro porque la emergencia puede declarar la suya en su fila —otra
 * ventana de tiempo, otra magnitud mínima, otros interruptores por defecto— y leyendo
 * `SEISMIC` directamente este módulo servía siempre la del preset. Se veía como que la
 * configuración del registro no hacía nada.
 */
function bounds(seismic: SeismicConfig, site?: SiteConfig): [[number, number], [number, number]] {
  return seismic.bounds ?? site?.country.geo.bounds ?? SEISMIC.bounds ?? [[-90, -180], [90, 180]];
}
import {
  byImpact,
  toQuakeAlert,
  type IntensityContour,
  type Quake,
} from "@/domain/hazard";

/**
 * The USGS earthquake catalogue, and nothing else in the app knows its wire format.
 *
 * Called straight from the browser: the FDSN service and the product store both send
 * `Access-Control-Allow-Origin: *`, so there is no proxy of ours in the path — which
 * during an emergency is one fewer thing of ours that can be down. The cost is that we
 * cannot cache it server-side; `useQuakes` handles that in localStorage instead.
 *
 * Everything here fails soft. A seismic overlay that cannot load must leave the shelter
 * map working, so the callers get an empty list and a flag, never an exception that
 * takes the map down with it.
 */

// ---------------------------------------------------------------------------
// Wire types — exactly what USGS sends, narrowed at the boundary
// ---------------------------------------------------------------------------

interface FeatureProps {
  mag: number | null;
  place: string | null;
  time: number | null;
  url: string | null;
  detail: string | null;
  felt: number | null;
  cdi: number | null;
  mmi: number | null;
  alert: string | null;
  tsunami: number | null;
  magType: string | null;
  types: string | null;
  type: string | null;
}

interface CatalogueFeature {
  id?: string;
  properties?: Partial<FeatureProps>;
  geometry?: { coordinates?: unknown };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * One catalogue entry, or null if it is unusable.
 *
 * A feature with no id, no magnitude or no coordinates cannot be drawn or linked, and a
 * pin at [0,0] off the coast of Africa is worse than a missing pin. Same for `type`:
 * the catalogue also carries quarry blasts and explosions, which are not the emergency.
 */
function toQuake(f: CatalogueFeature): Quake | null {
  const p = f.properties ?? {};
  const coords = f.geometry?.coordinates;
  if (!f.id || !Array.isArray(coords)) return null;
  if (p.type && p.type !== "earthquake") return null;

  const lng = num(coords[0]);
  const lat = num(coords[1]);
  const mag = num(p.mag);
  const time = num(p.time);
  if (lat === null || lng === null || mag === null || time === null) return null;

  return {
    id: f.id,
    magnitude: mag,
    magType: typeof p.magType === "string" ? p.magType : null,
    lat,
    lng,
    depthKm: num(coords[2]),
    place: typeof p.place === "string" ? p.place : "",
    time,
    alert: toQuakeAlert(p.alert),
    maxMmi: num(p.mmi),
    reportedMmi: num(p.cdi),
    feltReports: num(p.felt),
    tsunami: p.tsunami === 1,
    // `types` is a comma-delimited list with leading and trailing commas, e.g.
    // ",dyfi,losspager,origin,shakemap,". Match on the delimiters so "shakemap" cannot
    // be found inside some future product name that merely contains it.
    hasShakemap: typeof p.types === "string" && p.types.includes(",shakemap,"),
    url:
      typeof p.url === "string"
        ? p.url
        : `https://earthquake.usgs.gov/earthquakes/eventpage/${f.id}`,
    detailUrl: typeof p.detail === "string" ? p.detail : "",
  };
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/** Events in the configured window and box, strongest first, capped at `maxEvents`. */
export async function fetchQuakes(
  seismic: SeismicConfig,
  site: SiteConfig,
  signal?: AbortSignal,
): Promise<Quake[]> {
  const [[south, west], [north, east]] = bounds(seismic, site);
  const start = new Date(Date.now() - seismic.windowDays * 86_400_000);

  const qs = new URLSearchParams({
    format: "geojson",
    // Date only: a whole-day boundary is far more cacheable on their edge than a
    // timestamp that changes every poll, and the window is measured in days anyway.
    starttime: start.toISOString().slice(0, 10),
    minmagnitude: String(seismic.minMagnitude),
    minlatitude: String(south),
    maxlatitude: String(north),
    minlongitude: String(west),
    maxlongitude: String(east),
    orderby: "magnitude",
    // Ask for a little headroom over the cap so the client-side sort has something to
    // choose from rather than just echoing the server's ordering.
    limit: String(Math.min(500, seismic.maxEvents * 3)),
  });

  const res = await fetch(`${seismic.api}?${qs}`, { signal });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const body = (await res.json()) as { features?: unknown };
  if (!Array.isArray(body.features)) return [];

  return body.features
    .map((f) => toQuake(f as CatalogueFeature))
    .filter((q): q is Quake => q !== null)
    .sort(byImpact)
    .slice(0, seismic.maxEvents);
}

// ---------------------------------------------------------------------------
// ShakeMap intensity contours — the affected zone
// ---------------------------------------------------------------------------

interface ProductFile {
  url?: string;
}

interface DetailDoc {
  properties?: {
    products?: {
      shakemap?: { contents?: Record<string, ProductFile> }[];
    };
  };
}

interface ContourFeature {
  properties?: { value?: unknown; color?: unknown };
  geometry?: { type?: string; coordinates?: unknown };
}

/**
 * Where `cont_mmi.json` lives for an event.
 *
 * It has to be looked up rather than constructed: the product URL carries the ShakeMap
 * version timestamp, and that changes every time USGS revises the map — which for a live
 * event is several times in the first day. Guessing it would pin us to a stale revision.
 */
async function contourUrl(quake: Quake, signal?: AbortSignal): Promise<string | null> {
  if (!quake.detailUrl) return null;
  const res = await fetch(quake.detailUrl, { signal });
  if (!res.ok) return null;
  const doc = (await res.json()) as DetailDoc;
  const shakemap = doc.properties?.products?.shakemap?.[0];
  return shakemap?.contents?.["download/cont_mmi.json"]?.url ?? null;
}

/**
 * The MMI contours for one event, as polylines in Leaflet's [lat, lng] order.
 *
 * These are USGS's modelled shaking, published in their own colours. Drawing their lines
 * with their palette is deliberate: an intensity map is a thing people have seen before,
 * and a private colour scheme here would be a second scale to learn during an emergency.
 */
export async function fetchIntensityContours(
  quake: Quake,
  signal?: AbortSignal,
): Promise<IntensityContour[]> {
  const url = await contourUrl(quake, signal);
  if (!url) return [];

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const body = (await res.json()) as { features?: unknown };
  if (!Array.isArray(body.features)) return [];

  const out: IntensityContour[] = [];
  for (const raw of body.features as ContourFeature[]) {
    const mmi = num(raw.properties?.value);
    const geometry = raw.geometry;
    if (mmi === null || !Array.isArray(geometry?.coordinates)) continue;

    // ShakeMap writes MultiLineString, but a contour that closes into a single ring can
    // come back as a plain LineString. Normalise both to a list of lines.
    const raw3 = geometry.coordinates as unknown[];
    const lineStrings: unknown[] =
      geometry.type === "LineString" ? [raw3] : raw3;

    const lines: [number, number][][] = [];
    for (const ls of lineStrings) {
      if (!Array.isArray(ls)) continue;
      const pts: [number, number][] = [];
      for (const pt of ls) {
        if (!Array.isArray(pt)) continue;
        const lng = num(pt[0]);
        const lat = num(pt[1]);
        // GeoJSON is [lng, lat]; Leaflet is [lat, lng]. Swapping these is the classic
        // way to put Colombia in the Indian Ocean.
        if (lat !== null && lng !== null) pts.push([lat, lng]);
      }
      if (pts.length > 1) lines.push(pts);
    }
    if (lines.length === 0) continue;

    const color = typeof raw.properties?.color === "string" ? raw.properties.color : "#ff9100";
    out.push({ mmi, color, lines });
  }

  // Weakest first, so the strong inner contours paint over the weak outer ones where
  // they crowd together rather than being buried under them.
  return out.sort((a, b) => a.mmi - b.mmi);
}
