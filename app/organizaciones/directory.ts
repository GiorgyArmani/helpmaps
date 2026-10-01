import { unstable_cache } from "next/cache";
import { COUNTRY } from "@/config";
import { supabasePublic } from "@/lib/supabase/server";
import { isLocationType, type LocationType } from "@/domain/types";

/**
 * Los puntos publicados, en la forma mínima que necesita el buscador de `/organizaciones`.
 *
 * ── EN MEMORIA Y NO CON `ilike` ─────────────────────────────────────────────
 *
 * Son unos cientos de filas de cinco columnas: caben enteras y se filtran aquí. Además es
 * lo único que busca bien: quien escribe su organización en un teléfono no pone tildes, y
 * `ilike '%fundacion%'` no encuentra «Fundación». Normalizar las dos partes sí.
 *
 * Cacheado media hora por país y emergencia, como las cifras de `/inicio`: la página se
 * abre desde un mensaje de WhatsApp con una barra de señal, y el registro cambia por
 * días, no por minutos.
 */
export interface DirectoryEntry {
  id: string;
  name: string;
  type: LocationType;
  municipality: string | null;
  region: string | null;
  /** Null en una iniciativa digital: no tiene puerta, así que no va en el dibujo. */
  lat: number | null;
  lng: number | null;
  /** La emergencia a la que pertenece el punto, o null si es de siempre. */
  emergencyId: string | null;
}

/** PostgREST devuelve `numeric` como texto: se aceptan las dos formas. */
function coord(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function queryDirectory(emergencyId: string | null): Promise<DirectoryEntry[]> {
  const sb = supabasePublic();
  if (!sb) return [];
  try {
    let q = sb
      .from("locations")
      .select("id,name,type,municipality,region,lat,lng,emergency_id")
      .eq("active", true);
    // El mismo recorte que el mapa: los puntos de esta emergencia y los que no tienen.
    if (emergencyId) q = q.or(`emergency_id.eq.${emergencyId},emergency_id.is.null`);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Record<string, unknown>[])
      .filter((r) => isLocationType(r.type) && typeof r.name === "string")
      .map((r) => ({
        id: String(r.id),
        name: String(r.name),
        type: r.type as LocationType,
        municipality: typeof r.municipality === "string" ? r.municipality : null,
        region: typeof r.region === "string" ? r.region : null,
        lat: coord(r.lat),
        lng: coord(r.lng),
        emergencyId: typeof r.emergency_id === "string" ? r.emergency_id : null,
      }));
  } catch {
    return [];
  }
}

export const fetchDirectory = unstable_cache(queryDirectory, ["org-directory-v3", COUNTRY.slug], {
  revalidate: 1800,
});

/** Minúsculas, sin tildes y sin signos: «Fundación "Amigos"» y «fundacion amigos» son lo mismo. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * Las que contienen TODAS las palabras buscadas, en cualquier orden. Primero las que
 * empiezan por lo escrito: quien teclea «casa hogar» busca «Casa Hogar …», no un punto
 * que dice «hogar» en mitad del nombre.
 */
export function searchDirectory(
  entries: DirectoryEntry[],
  query: string,
  limit = 8,
): DirectoryEntry[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const words = q.split(" ");
  return entries
    .map((e) => ({ e, n: fold(e.name) }))
    .filter(({ n }) => words.every((w) => n.includes(w)))
    .sort((a, b) => Number(b.n.startsWith(q)) - Number(a.n.startsWith(q)) || a.n.localeCompare(b.n))
    .slice(0, limit)
    .map(({ e }) => e);
}

// ───────────────────────────────────────────────────────────────────────────
// El mapa de la portada, hecho con los propios puntos.
//
// Un SVG del servidor, sin teselas, sin Leaflet y sin una sola petición más: la silueta
// del país rellena de una trama, y encima UN punto por cada lugar de ayuda publicado.
// ───────────────────────────────────────────────────────────────────────────

/** Una décima de grado por unidad: en esta latitud, unos 11 km. */
const SCALE = 10;

/** El lado de una «zona» para comprimir la densidad: unos 14 km. */
const GRID = 1.3;

export interface DotMap {
  viewBox: string;
  /** La silueta del país como trazado SVG, o null si el preset no la trae. */
  outline: string | null;
  /** `k`, de 0 a 11: el turno en que brota al cargar la página. */
  dots: { x: number; y: number; k: number }[];
  /** Dónde se enciende, de vez en cuando, una onda de «actividad». */
  pings: { x: number; y: number }[];
  hits: { x: number; y: number }[];
}

/**
 * Un número estable a partir de dos enteros. Da el orden en que brotan los puntos
 * —repartido por todo el país en vez de barrer de oeste a este— y es el mismo en cada
 * recarga, así que servidor y navegador pintan lo mismo.
 */
function hash2(a: number, b: number): number {
  let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** ¿El punto (x, y) cae dentro del anillo? Rayo horizontal, par/impar. */
function inside(px: number, py: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Proyección equirectangular. En Venezuela la corrección por coseno de la latitud es
 * menor del 1 % y no se nota; un país lejos del ecuador la necesitaría, y entonces se
 * pone aquí y en ningún otro sitio.
 *
 * ── REPARTIDOS, CON LA DENSIDAD COMPRIMIDA ──────────────────────────────────
 *
 * Buena parte del registro está en Caracas y La Guaira, y cada intento ingenuo se veía
 * mal allí: fundir los cercanos en un círculo que crecía con el recuento daba borrones
 * sobre la costa; ajustarlos a una rejilla dejaba 117 puntos perdidos en la trama; y un
 * punto por lugar, repartido, convertía Caracas en un bloque macizo.
 *
 * Lo que funciona: cada zona de unos 14 km dibuja la RAÍZ de sus lugares (1 → 1, 4 → 2,
 * 100 → 10), cada uno desde su posición real, y los que quedan demasiado juntos se
 * empujan hasta dejar aire, sin salir del país. Un intento con rejilla llenaba la franja
 * costera en hileras; esto da una nube. Caracas se sigue leyendo como la zona más
 * tupida, sin taparse a sí misma ni tapar la costa.
 */
export function dotMap(
  entries: DirectoryEntry[],
  geo: {
    bounds: [[number, number], [number, number]];
    outline?: [number, number][];
  },
  hitIds: Set<string>,
): DotMap | null {
  const [[s0, w0], [n0, e0]] = geo.bounds;
  const placed = entries.filter(
    (e): e is DirectoryEntry & { lat: number; lng: number } =>
      e.lat !== null && e.lng !== null && e.lat >= s0 && e.lat <= n0 && e.lng >= w0 && e.lng <= e0,
  );
  if (placed.length < 10) return null;

  const x = (lng: number) => (lng - w0) * SCALE;
  const y = (lat: number) => (n0 - lat) * SCALE;
  const ring = geo.outline && geo.outline.length > 2 ? geo.outline : null;
  const poly: [number, number][] | null = ring ? ring.map(([lat, lng]) => [x(lng), y(lat)]) : null;

  // Cuántos lugares caen en cada celda de origen: decide el orden de colocación.
  const pts = placed.map((e) => {
    const px = x(e.lng);
    const py = y(e.lat);
    return { e, px, py, i: Math.round(px / GRID), j: Math.round(py / GRID) };
  });
  const crowd = new Map<string, number>();
  for (const p of pts) crowd.set(`${p.i}:${p.j}`, (crowd.get(`${p.i}:${p.j}`) ?? 0) + 1);
  pts.sort(
    (a, b) =>
      crowd.get(`${a.i}:${a.j}`)! - crowd.get(`${b.i}:${b.j}`)! ||
      a.e.id.localeCompare(b.e.id),
  );

  // Cuántos puntos dibuja cada zona: la raíz de sus lugares. Los primeros
  // de cada zona, en el orden estable de arriba, son los que se dibujan.
  const quota = new Map<string, number>();
  for (const [key, n] of crowd) quota.set(key, Math.max(1, Math.round(Math.sqrt(n))));

  // Los puntos que se dibujan: la cuota de cada zona, desde su posición REAL. Un empujón
  // mínimo y estable (del hash) separa los que comparten coordenadas exactas.
  const nodes: { id: string; x: number; y: number }[] = [];
  for (const p of pts) {
    const key = `${p.i}:${p.j}`;
    const left = quota.get(key)!;
    if (left <= 0) continue;
    quota.set(key, left - 1);
    const h = hash2(p.i * 131 + nodes.length, p.j);
    nodes.push({
      id: p.e.id,
      x: p.px + ((h & 0xff) / 255 - 0.5) * 0.4,
      y: p.py + (((h >>> 8) & 0xff) / 255 - 0.5) * 0.4,
    });
  }

  // Relajación: los que quedan a menos de MIN se empujan a partes iguales hasta dejar
  // aire. Una nube orgánica en vez de hileras de rejilla. Un empujón que sacaría un punto
  // del país no se aplica, y el punto se queda donde estaba.
  const MIN = 1.7;
  for (let it = 0; it < 40; it++) {
    let moved = false;
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const A = nodes[a]!;
        const B = nodes[b]!;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        const push = (MIN - d) / 2 + 0.01;
        const ux = d > 1e-6 ? dx / d : 1;
        const uy = d > 1e-6 ? dy / d : 0;
        const ax = A.x - ux * push;
        const ay = A.y - uy * push;
        const bx = B.x + ux * push;
        const by = B.y + uy * push;
        if (!poly || inside(ax, ay, poly)) {
          A.x = ax;
          A.y = ay;
        }
        if (!poly || inside(bx, by, poly)) {
          B.x = bx;
          B.y = by;
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  const at = (n: { x: number; y: number }) => ({ x: +n.x.toFixed(2), y: +n.y.toFixed(2) });
  const cells = nodes.map((n) => ({ ...n, i: Math.round(n.x * 10), j: Math.round(n.y * 10) }));

  const frameX = poly ? poly.map(([px]) => px) : cells.map((c) => c.x);
  const frameY = poly ? poly.map(([, py]) => py) : cells.map((c) => c.y);
  const pad = 3;
  const minX = Math.floor(Math.min(...frameX)) - pad;
  const minY = Math.floor(Math.min(...frameY)) - pad;
  const w = Math.ceil(Math.max(...frameX)) + pad - minX;
  const h = Math.ceil(Math.max(...frameY)) + pad - minY;

  return {
    viewBox: `${minX} ${minY} ${w} ${h}`,
    outline: poly ? `M${poly.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join("L")}Z` : null,
    dots: cells.map((c) => ({ ...at(c), k: hash2(c.i, c.j) % 12 })),
    // Ocho, elegidos por el hash: salen en sitios distintos del país.
    pings: [...cells]
      .sort((a, b) => hash2(b.j, b.i) - hash2(a.j, a.i))
      .slice(0, 8)
      .map(at),
    // Lo encontrado va en su sitio EXACTO, encima del racimo: es la respuesta a «¿dónde
    // está la mía?», y ahí la precisión importa más que el orden de la rejilla.
    hits: placed
      .filter((e) => hitIds.has(e.id))
      .map((e) => ({ x: +x(e.lng).toFixed(2), y: +y(e.lat).toFixed(2) })),
  };
}

/**
 * Dónde está pasando la emergencia, en las coordenadas del dibujo de `dotMap`. La portada
 * de `/inicio` hace zoom hasta ahí.
 *
 * ── DE LOS DATOS, NUNCA DE UN NOMBRE ESCRITO ────────────────────────────────
 *
 * Nada aquí sabe que en 2026 fue La Guaira. En orden:
 *
 *   1. Las zonas afectadas que dibujó quien opera la emergencia: su centro.
 *   2. Si no hay zonas, la zona más tupida de los puntos DE esa emergencia (unos 30 km
 *      de lado, promediada con sus vecinas para no caer en el borde de una celda).
 *   3. Si ningún punto está marcado con la emergencia, la más tupida de todos.
 *
 * Así otro país, u otra emergencia en Venezuela, cae donde tiene que caer sin tocar esto.
 * `place` es la región más repetida alrededor del foco, para rotularlo.
 */
export interface MapFocus {
  x: number;
  y: number;
  place: string | null;
}

export function emergencyFocus(
  entries: DirectoryEntry[],
  geo: { bounds: [[number, number], [number, number]] },
  emergencyId: string,
  zones: { label: string; ring: [number, number][] }[],
): MapFocus | null {
  const [[, w0], [n0]] = geo.bounds;
  const x = (lng: number) => +((lng - w0) * SCALE).toFixed(2);
  const y = (lat: number) => +((n0 - lat) * SCALE).toFixed(2);

  const ring = zones.flatMap((z) => z.ring);
  if (ring.length > 0) {
    const lat = ring.reduce((a, [la]) => a + la, 0) / ring.length;
    const lng = ring.reduce((a, [, lo]) => a + lo, 0) / ring.length;
    return { x: x(lng), y: y(lat), place: zones[0]?.label ?? null };
  }

  const placed = entries.filter(
    (e): e is DirectoryEntry & { lat: number; lng: number } => e.lat !== null && e.lng !== null,
  );
  const own = placed.filter((e) => e.emergencyId === emergencyId);
  const pool = own.length >= 5 ? own : placed;
  if (pool.length === 0) return null;

  const CELL = 0.3;
  const key = (e: { lat: number; lng: number }) =>
    `${Math.floor(e.lat / CELL)}:${Math.floor(e.lng / CELL)}`;
  const cells = new Map<string, number>();
  for (const e of pool) cells.set(key(e), (cells.get(key(e)) ?? 0) + 1);
  const [best] = [...cells.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]!;
  const [bi, bj] = best.split(":").map(Number) as [number, number];

  const near = pool.filter((e) => {
    const i = Math.floor(e.lat / CELL);
    const j = Math.floor(e.lng / CELL);
    return Math.abs(i - bi) <= 1 && Math.abs(j - bj) <= 1;
  });
  const lat = near.reduce((a, e) => a + e.lat, 0) / near.length;
  const lng = near.reduce((a, e) => a + e.lng, 0) / near.length;

  const regions = new Map<string, number>();
  for (const e of near) if (e.region) regions.set(e.region, (regions.get(e.region) ?? 0) + 1);
  const place = [...regions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { x: x(lng), y: y(lat), place };
}
