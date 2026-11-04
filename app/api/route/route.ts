import { NextResponse } from "next/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

/**
 * La ruta por calles de donde estás a un punto, a pie y en carro.
 *
 *   POST { from: {lat,lng}, to: {lat,lng} }
 *     →  { foot: Leg | null, car: Leg | null }      Leg = { km, min, line: [lat,lng][] }
 *
 * ── LA UBICACIÓN NO SE GUARDA ──────────────────────────────────────────────
 *
 * Es la misma regla que `api/checkin`: llega, se usa y se va con la petición. No se
 * escribe en ninguna tabla, no hay un solo `console.log` con coordenadas en este archivo
 * —y no puede haberlo nunca—, y viaja en el CUERPO del POST, no en la dirección, para que
 * no quede en los registros de acceso de nadie.
 *
 * Pasa por aquí y no va directo del teléfono al servidor de rutas por dos motivos: el
 * servidor de rutas no ve la IP de la persona, sólo la nuestra; y cambiar de servidor es
 * cambiar una variable, sin tocar la app.
 *
 * ── EL SERVIDOR DE RUTAS ───────────────────────────────────────────────────
 *
 * `ROUTING_FOOT_URL` y `ROUTING_CAR_URL`: un OSRM por perfil (el nuestro, en `infra/osrm`,
 * con `ROUTING_KEY`). Por defecto, el público de
 * FOSSGIS sobre OpenStreetMap, que SÓLO sirve para probar: su política de uso no admite
 * el tráfico de una app, y es un tercero que vería las coordenadas. En producción va un
 * OSRM propio con el extracto del país, sin registros.
 */

const FOOT = process.env.ROUTING_FOOT_URL || "https://routing.openstreetmap.de/routed-foot";
const CAR = process.env.ROUTING_CAR_URL || "https://routing.openstreetmap.de/routed-car";
/**
 * La clave de la puerta del OSRM propio (`infra/osrm`): sin ella responde 401, así que nadie
 * más puede usar nuestro servidor de rutas. Sólo vive en el servidor, nunca en el navegador.
 */
const KEY = process.env.ROUTING_KEY || "";

/** Pedir una ruta es un toque, no una ráfaga. */
const MAX_PER_IP = 20;

/** Más lejos que esto no es «cómo llegar a pie o en carro», es un viaje. */
const MAX_KM = 400;

interface Leg {
  km: number;
  min: number;
  /** [lat, lng], como los quiere Leaflet. */
  line: [number, number][];
}

function point(v: unknown): { lat: number; lng: number } | null {
  const o = (v ?? {}) as Record<string, unknown>;
  const lat = typeof o.lat === "number" ? o.lat : NaN;
  const lng = typeof o.lng === "number" ? o.lng : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function roughKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

async function leg(base: string, from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<Leg | null> {
  const url =
    `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=simplified&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: KEY ? { "x-routing-key": KEY } : undefined,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!r) return null;
    return {
      km: r.distance / 1000,
      min: Math.max(1, Math.round(r.duration / 60)),
      line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const limit = rateLimit(`route:${clientIp(req.headers)}`, MAX_PER_IP);
  if (!limit.ok) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const from = point(raw.from);
  const to = point(raw.to);
  if (!from || !to) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (roughKm(from, to) > MAX_KM) return NextResponse.json({ error: "too_far" }, { status: 422 });

  const [foot, car] = await Promise.all([leg(FOOT, from, to), leg(CAR, from, to)]);
  return NextResponse.json({ foot, car }, { headers: { "cache-control": "no-store" } });
}
