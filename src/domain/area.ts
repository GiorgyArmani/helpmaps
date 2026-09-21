/**
 * La zona afectada: dónde pegó esto.
 *
 * ── QUÉ RESUELVE, Y QUÉ NO ──────────────────────────────────────────────────
 *
 * Para un terremoto la huella ya existe y es mejor que cualquier cosa que dibujemos a
 * mano: los contornos de intensidad que publica USGS (`src/domain/hazard.ts`), que son
 * sacudida modelada y no una estimación de nadie de este lado. Donde los haya, mandan.
 *
 * Esto es para todo lo demás. Una inundación, un incendio, un derrumbe: no hay servicio
 * mundial que publique su huella, y sin esto el mapa no tiene forma de decir hasta dónde
 * llegó. Y son VARIAS: dos ríos desbordados en dos estados son dos zonas de la misma
 * emergencia, cada una con su nombre y su gravedad.
 *
 * ── POR QUÉ EL PUNTO-EN-POLÍGONO VIVE ACÁ ───────────────────────────────────
 *
 * Porque la respuesta a «¿estoy dentro?» se calcula en el teléfono, con la ubicación que
 * no sale de él. Es la misma regla que ya siguen las distancias: preguntarle al servidor
 * si esta persona está dentro de la zona grave es mandarle su posición, y esa posición no
 * se manda a ningún sitio. Además es gratis — el polígono ya está en memoria.
 */

/** 1 aviso · 2 afectada · 3 grave. Tres, porque una escala que nadie recuerda no informa. */
export type Severity = 1 | 2 | 3;

export const SEVERITIES: Severity[] = [1, 2, 3];

export interface AffectedZone {
  /** Estable: es la identidad de la zona y sobrevive a un cambio de nombre. */
  id: string;
  label: string;
  severity: Severity;
  /**
   * El anillo, en orden [lat, lng] —el de Leaflet, no el de GeoJSON— y ABIERTO: el último
   * vértice no repite el primero. Lo cierran tanto Leaflet como `pointInRing`.
   */
  ring: [number, number][];
  /** Una línea: qué pasa ahí. Opcional. */
  note?: string;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function toSeverity(v: unknown): Severity | null {
  return v === 1 || v === 2 || v === 3 ? v : null;
}

/** Los vértices utilizables de un anillo, descartando lo que no sea un par de números. */
function toRing(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  const out: [number, number][] = [];
  for (const pt of v) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lat = pt[0];
    const lng = pt[1];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // Fuera del planeta no es un vértice, es un dato corrupto. Y un [0,0] colado en un
    // anillo lo estira hasta el golfo de Guinea, que se ve como un fallo del mapa.
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    out.push([lat, lng]);
  }
  return out;
}

/**
 * Lee la columna `area`. Una zona mal escrita se DESCARTA, no revienta.
 *
 * Misma regla que `parseLayers`: esto es jsonb que edita una persona durante una
 * emergencia, y una entrada rota tiene que costar esa zona y no el mapa entero.
 */
export function parseZones(value: unknown): AffectedZone[] {
  if (!Array.isArray(value)) return [];
  const out: AffectedZone[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;

    const id = str(o.id);
    const label = str(o.label);
    const severity = toSeverity(o.severity);
    const ring = toRing(o.ring);
    // Con dos vértices no hay área que pintar ni dentro que contestar: es una raya.
    if (!id || !label || !severity || ring.length < 3 || seen.has(id)) continue;

    seen.add(id);
    out.push({ id, label, severity, ring, note: str(o.note) ?? undefined });
  }
  return out;
}

/**
 * ¿Cae el punto dentro del anillo?
 *
 * Lanzamiento de rayo (par-impar): se cuenta cuántas veces un rayo horizontal hacia el
 * este cruza los lados. Impar es dentro. El anillo se trata como cerrado, así que el
 * último vértice se une al primero sin repetirlo en los datos.
 *
 * En grados, sin proyectar: a escala de una zona afectada la deformación de la latitud no
 * cambia de lado ningún punto, y proyectar costaría traerse la esfera a un cálculo que se
 * hace en el móvil de alguien. El antimeridiano sí lo rompería — y ninguna emergencia se
 * sirve a caballo de él; el día que pase, se parte en dos zonas.
 */
export function pointInRing(ring: [number, number][], lat: number, lng: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!a || !b) continue;
    const latI = a[0];
    const lngI = a[1];
    const latJ = b[0];
    const lngJ = b[1];
    // Sólo los lados que cruzan la latitud del punto pueden ser atravesados por el rayo.
    if (latI > lat !== latJ > lat) {
      const x = lngI + ((lat - latI) / (latJ - latI)) * (lngJ - lngI);
      if (lng < x) inside = !inside;
    }
  }
  return inside;
}

/**
 * La zona en la que cae un punto y, si cae en varias, la MÁS GRAVE.
 *
 * Las zonas se solapan a propósito —un aviso ancho con un núcleo grave dentro— y ahí la
 * respuesta útil es siempre la peor: quien está en el núcleo necesita leer «grave», no
 * «aviso» porque esa zona se declarara primero.
 */
export function zoneAt(
  zones: AffectedZone[],
  lat: number,
  lng: number,
): AffectedZone | null {
  let hit: AffectedZone | null = null;
  for (const zone of zones) {
    if (!pointInRing(zone.ring, lat, lng)) continue;
    if (!hit || zone.severity > hit.severity) hit = zone;
  }
  return hit;
}

/** El centro aproximado de una zona, para encuadrarla. Promedio de vértices, y alcanza. */
export function ringCenter(ring: [number, number][]): [number, number] {
  let lat = 0;
  let lng = 0;
  for (const pt of ring) {
    lat += pt[0];
    lng += pt[1];
  }
  return [lat / ring.length, lng / ring.length];
}

/** Un id corto y estable a partir del nombre, para una zona recién dibujada. */
export function zoneId(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFD")
      // Descompuesto y sin las marcas: "Mérida" → "merida". `\p{Diacritic}` en vez del
      // rango de combinantes, que en el fuente se ve como una clase vacía.
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "zona";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
