import type { Center } from "@/domain/types";
import type { Region } from "@/config/types";
import { distanceKm, hasCoords, isDigital, servesRegion } from "@/domain/center";

// ───────────────────────────────────────────────────────────────────────────
// «¿Qué hay cerca de mí?»
//
// La lista de todo el país contesta una pregunta que nadie hace. Quien abre esto en la
// calle quiere saber a qué puerta llegar caminando, y el orden por nombre o por
// {region} no le sirve para eso.
//
// Todo el cálculo es en cliente sobre los puntos que la app ya se descargó. Ver
// `features/nearby/useMyLocation.ts` para por qué no es una consulta al servidor.
// ───────────────────────────────────────────────────────────────────────────

export interface Near {
  center: Center;
  /** Distancia en línea recta. No es lo que se camina, y la UI no dice que lo sea. */
  km: number;
}

/**
 * Los radios que se ofrecen, en km.
 *
 * 2 km es «lo que se hace a pie»; 50 km es «me monto en algo». Un radio libre con un
 * deslizador sería más flexible y peor: cuatro opciones se tocan con el pulgar sin mirar,
 * y nadie tiene una opinión sobre si su radio son 14 o 17 km.
 */
export const RADIUS_CHOICES = [2, 5, 15, 50] as const;
export type RadiusKm = (typeof RADIUS_CHOICES)[number];
export const DEFAULT_RADIUS: RadiusKm = 5;

/**
 * Los puntos físicos dentro del radio, del más cercano al más lejano.
 *
 * Las iniciativas digitales quedan fuera por definición: no tienen coordenadas y
 * ordenarlas por distancia sería inventarse una. Entran por `digitalCovering()`.
 */
export function nearbyPoints(
  centers: Center[],
  from: { lat: number; lng: number },
  radiusKm: number,
): Near[] {
  const out: Near[] = [];
  for (const center of centers) {
    if (isDigital(center) || !hasCoords(center)) continue;
    const km = distanceKm(from, center);
    if (km <= radiusKm) out.push({ center, km });
  }
  return out.sort((a, b) => a.km - b.km);
}

/**
 * La {region} en la que probablemente está quien mira: la de centroide más próximo.
 *
 * Es una aproximación grosera —un centroide no es una frontera, y quien está en el borde
 * de dos estados puede caer del lado equivocado— y se usa SOLO para decidir qué
 * iniciativas sin sede mostrar. Nunca para etiquetar a nadie, ni para filtrar puntos
 * físicos: esos se filtran por distancia real, que no tiene ese error.
 */
export function nearestRegion(regions: Region[], from: { lat: number; lng: number }): Region | null {
  let best: Region | null = null;
  let bestKm = Infinity;
  for (const region of regions) {
    const km = distanceKm(from, region);
    if (km < bestKm) {
      bestKm = km;
      best = region;
    }
  }
  return best;
}

/**
 * Las iniciativas sin sede que atienden esa {region}.
 *
 * `servesRegion` ya trata la lista vacía como «todo el país», así que una campaña
 * nacional sale aquí siempre — que es lo correcto: ayuda a esta persona esté donde esté.
 */
export function digitalCovering(centers: Center[], regionCode: string | null): Center[] {
  if (!regionCode) return [];
  return centers.filter((c) => isDigital(c) && servesRegion(c, regionCode));
}

/**
 * «600 m» / «4,2 km» / «38 km».
 *
 * Debajo del kilómetro se dice en metros porque es la única franja en la que el número
 * cambia una decisión: 300 m se va andando, 900 m también, «0,3 km» hay que traducirlo
 * mentalmente. Redondeado a 50 m para no fingir una precisión que el GPS de un teléfono
 * en la calle no tiene.
 */
export function formatKm(km: number, lang: string): string {
  if (km < 1) {
    const m = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${m} m`;
  }
  // Un decimal sólo si dice algo: «4,2 km» sí, «2,0 km» no. Los radios que ofrecemos son
  // todos redondos, y con el cero de relleno la fila de pastillas no cabía sin desplazar.
  const value = km < 10 ? km.toFixed(1).replace(/\.0$/, "") : String(Math.round(km));
  // Coma decimal en español y portugués, punto en inglés.
  return `${lang === "en" ? value : value.replace(".", ",")} km`;
}
