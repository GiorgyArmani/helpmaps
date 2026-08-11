// Seismic domain model — the shape the app works in, independent of the USGS wire
// format. `src/features/hazard/usgs.ts` is the only place that knows what the catalogue
// JSON looks like; everything else consumes these types.

/**
 * PAGER alert level: USGS's own estimate of the human and economic impact of an event,
 * from a model of the shaking against population and building stock. It is the closest
 * thing the feed carries to "how bad is the damage", and it is still an ESTIMATE
 * published within minutes and revised later.
 */
export type QuakeAlert = "green" | "yellow" | "orange" | "red";

const ALERTS: QuakeAlert[] = ["green", "yellow", "orange", "red"];

export function toQuakeAlert(v: unknown): QuakeAlert | null {
  return typeof v === "string" && (ALERTS as string[]).includes(v) ? (v as QuakeAlert) : null;
}

/** One event from the catalogue, normalised. */
export interface Quake {
  /** USGS event id, e.g. "us6000tjl2". Stable, and the key for the ShakeMap products. */
  id: string;
  magnitude: number;
  /** Magnitude scale actually used (mww, mb…). Shown because M is not one measurement. */
  magType: string | null;
  lat: number;
  lng: number;
  /** Kilometres. Depth is why two same-magnitude events do very different damage. */
  depthKm: number | null;
  /** USGS's English place description, e.g. "5 km S of San José del Palmar, Colombia". */
  place: string;
  /** Event origin time, epoch ms. */
  time: number;
  alert: QuakeAlert | null;
  /** Peak modelled shaking intensity (MMI) anywhere on the ShakeMap. */
  maxMmi: number | null;
  /** Peak intensity actually REPORTED by people ("Did You Feel It"). */
  reportedMmi: number | null;
  /** How many people filed a felt report. */
  feltReports: number | null;
  tsunami: boolean;
  /** True when USGS published a ShakeMap, i.e. intensity contours may exist. */
  hasShakemap: boolean;
  /** The USGS event page. Always link out rather than restate their analysis. */
  url: string;
  /** The event detail document, where the ShakeMap product URLs live. */
  detailUrl: string;
}

/** One MMI contour line from a ShakeMap, in Leaflet [lat, lng] order. */
export interface IntensityContour {
  /** Modified Mercalli intensity this line traces. */
  mmi: number;
  /** USGS's own colour for that intensity. Using theirs keeps the map legible to
   *  anyone who has ever seen a ShakeMap, and avoids inventing a competing scale. */
  color: string;
  /** Each entry is one polyline. */
  lines: [number, number][][];
}

// ---------------------------------------------------------------------------
// The Modified Mercalli scale
// ---------------------------------------------------------------------------

/**
 * The USGS ShakeMap intensity scale. Two things are attached to every degree, and they
 * are NOT the same question:
 *
 *   shaking — what it felt like.
 *   damage  — what it does to ordinary construction.
 *
 * The user asking "did this reach us" is asking the first; the one deciding whether to
 * open a shelter is asking the second. Both are dictionary keys, translated per language,
 * because this table is read by people in the affected area.
 */
export interface IntensityBand {
  /** Lower bound, inclusive. A value of 6.4 is degree VI. */
  degree: number;
  /** Roman numeral, the conventional label on every intensity map. */
  roman: string;
  color: string;
}

/** Degree I: felt by nobody, does nothing. Also the floor `intensityBand` clamps to. */
const NOT_FELT: IntensityBand = { degree: 1, roman: "I", color: "#ffffff" };

export const INTENSITY_BANDS: IntensityBand[] = [
  NOT_FELT,
  { degree: 2, roman: "II–III", color: "#bfccff" },
  { degree: 4, roman: "IV", color: "#a0e6ff" },
  { degree: 5, roman: "V", color: "#80ffff" },
  { degree: 6, roman: "VI", color: "#7cff7c" },
  { degree: 7, roman: "VII", color: "#ffff00" },
  { degree: 8, roman: "VIII", color: "#ffc800" },
  { degree: 9, roman: "IX", color: "#ff9100" },
  { degree: 10, roman: "X+", color: "#ff0000" },
];

/** The band a modelled intensity falls in. Values below I clamp to I, above X to X+. */
export function intensityBand(mmi: number): IntensityBand {
  const floor = Math.floor(mmi);
  let band: IntensityBand = NOT_FELT;
  for (const b of INTENSITY_BANDS) if (floor >= b.degree) band = b;
  return band;
}

/**
 * Dictionary key for the perceived shaking / potential damage of an intensity. Bands II
 * and III share a row on the USGS scale, so the keys are numbered by band, not by degree.
 */
export function intensityKey(mmi: number): string {
  return `mmi.${intensityBand(mmi).degree}`;
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Strongest first, and on a tie the most recent first. The cap in `maxEvents` cuts from
 * the bottom of this order, so what gets dropped is always the least consequential —
 * never the main shock because a swarm of M4.5 aftershocks arrived after it.
 */
export function byImpact(a: Quake, b: Quake): number {
  return b.magnitude - a.magnitude || b.time - a.time;
}

/** The event a first-time visitor is asking about: the strongest one in the window. */
export function principalQuake(quakes: Quake[]): Quake | null {
  return [...quakes].sort(byImpact)[0] ?? null;
}
