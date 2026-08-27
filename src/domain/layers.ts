/**
 * Extra map overlays an emergency declares for itself.
 *
 * ── WHY THESE ARE DATA AND NOT COMPONENTS ───────────────────────────────────
 *
 * AcopioVE ships seven of these — SAR satellite damage, extruded damaged buildings, rain,
 * weather, alerts, a historical earthquake — and every one of them is specific to ONE
 * event, not to a country and not to the network. The damaged-building snapshot of Catia
 * La Mar means nothing in a flood somewhere else, and shipping it as a component would put
 * a dead switch in every deployment that inherited the code.
 *
 * So an emergency declares what it has, in its own row, and the layers panel is built from
 * that. A deployment with none simply shows the seismic toggles it always had.
 *
 * ── THE SHAPE IS DELIBERATELY SMALL ─────────────────────────────────────────
 *
 * Three kinds cover everything AcopioVE actually runs: raster tiles (rain, weather),
 * GeoJSON (damage footprints, alerts, SAR outlines), and extruded buildings — the 3D view
 * of structural damage. Anything that needs more than a URL and a colour is a component,
 * and it should be argued for as one rather than smuggled in through a config field.
 *
 * `buildings3d` is not drawn on the main map: it is a whole other renderer (MapLibre, and
 * close to a megabyte of it), so it lives on its own route and the main map only offers a
 * button to it. Declaring it here rather than hardcoding it is what keeps that button from
 * appearing in deployments that have no such dataset — a button leading to an empty 3D
 * scene is worse than no button.
 */
export type LayerKind = "tiles" | "geojson" | "buildings3d";

export interface EmergencyLayer {
  /** Stable key. Also the toggle's identity, so it survives a relabel. */
  id: string;
  label: string;
  kind: LayerKind;
  url: string;
  /** Shown whenever the layer is on. For most sources this is a licence condition. */
  attribution: string;
  /** Whether it starts switched on. */
  defaultOn: boolean;
  /** One line under the label: what the reader is actually looking at. */
  hint?: string;
  /** Raster only. */
  opacity?: number;
  maxZoom?: number;
  /** GeoJSON only: the stroke and fill for its features. */
  color?: string;
  /**
   * buildings3d only: the feature property that drives the extrusion height.
   *
   * In AcopioVE's dataset it is the estimated damage percentage, NOT the building's real
   * height — a taller block means more damage, and the legend has to say so or the scene
   * reads as a skyline.
   */
  heightProperty?: string;
  /**
   * buildings3d only: the value of `heightProperty` that means "maximum damage".
   *
   * It exists because datasets disagree about scale and nothing in the file says which
   * they use: AcopioVE's Catia La Mar snapshot stores `damage_pct_0m` as a FRACTION
   * (0.451), while a set that stores percentages would put 45.1 in the same field.
   * Reading either one raw makes the scene wrong in a way that still renders — buildings
   * a few centimetres tall, or a colour ramp stuck on its first stop.
   *
   * Defaults to 100, the percentage reading.
   */
  valueMax?: number;
  /** buildings3d only: metres of extrusion at maximum damage. */
  heightScale?: number;
  /** buildings3d only: where to open the scene. Falls back to the country viewport. */
  center?: [number, number];
  zoom?: number;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isFetchableUrl(url: string): boolean {
  // Una ruta absoluta del propio despliegue: un archivo en `public/`. Es como AcopioVE
  // sirve su instantánea de edificios dañados, y es la forma correcta de referenciar un
  // conjunto que viaja con el repositorio — sin dominio que se caiga y sin origen cruzado.
  // Se descarta `//` porque eso es una URL sin esquema hacia OTRO host, no una ruta local.
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (url.startsWith("https://")) return true;
  if (!url.startsWith("http://")) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Read the `layers` column into something the map can draw.
 *
 * Every entry is validated and a bad one is DROPPED rather than throwing. This column is
 * free-form JSON edited by a person in the registry console: one malformed entry must cost
 * that overlay, not the whole map. The rest of the emergency is still worth serving.
 */
export function parseLayers(value: unknown): EmergencyLayer[] {
  if (!Array.isArray(value)) return [];
  const out: EmergencyLayer[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;

    const id = str(o.id);
    const label = str(o.label);
    const url = str(o.url);
    const kind: LayerKind | null =
      o.kind === "tiles" || o.kind === "geojson" || o.kind === "buildings3d" ? o.kind : null;
    if (!id || !label || !url || !kind || seen.has(id)) continue;

    // Only https, because these are fetched by the browser on a page served over https and
    // a plain-http overlay is blocked as mixed content anyway — dropping it here at least
    // says why, in the one place someone would look.
    //
    // `localhost` is the exception, and not a hole in the rule: browsers treat it as a
    // secure context on purpose, precisely so that development works without certificates.
    // Without this a layer could not be tried locally before being pointed at production.
    if (!isFetchableUrl(url)) continue;

    seen.add(id);
    out.push({
      id,
      label,
      kind,
      url,
      attribution: str(o.attribution) ?? "",
      defaultOn: o.defaultOn === true,
      hint: str(o.hint) ?? undefined,
      opacity: typeof o.opacity === "number" ? clamp(o.opacity, 0, 1) : undefined,
      maxZoom: typeof o.maxZoom === "number" ? o.maxZoom : undefined,
      color: str(o.color) ?? undefined,
      heightProperty: str(o.heightProperty) ?? undefined,
      valueMax: typeof o.valueMax === "number" && o.valueMax > 0 ? o.valueMax : undefined,
      heightScale: typeof o.heightScale === "number" && o.heightScale > 0 ? o.heightScale : undefined,
      center: pair(o.center),
      zoom: typeof o.zoom === "number" ? o.zoom : undefined,
    });
  }
  return out;
}

/** The initial on/off state: whatever each layer declares for itself. */
export function defaultLayerState(layers: EmergencyLayer[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const layer of layers) out[layer.id] = layer.defaultOn;
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pair(v: unknown): [number, number] | undefined {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number")
    ? [v[0] as number, v[1] as number]
    : undefined;
}

/** The 3D datasets this emergency declares. Empty is the normal case. */
export function buildingLayers(layers: EmergencyLayer[]): EmergencyLayer[] {
  return layers.filter((l) => l.kind === "buildings3d");
}

/** The overlays that belong on the main map — everything except the 3D scenes. */
export function mapLayers(layers: EmergencyLayer[]): EmergencyLayer[] {
  return layers.filter((l) => l.kind !== "buildings3d");
}
