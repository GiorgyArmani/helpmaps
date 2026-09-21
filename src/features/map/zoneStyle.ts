import type { Severity } from "@/domain/area";

/**
 * El color de una zona afectada según su gravedad.
 *
 * ── POR QUÉ SE LEE EL TOKEN EN VEZ DE ESCRIBIR EL COLOR ─────────────────────
 *
 * Porque la regla de la casa es que ningún color se escribe a mano: salen de
 * `config/brand.ts`, que es lo que hace que re-marcar un país sea una edición de
 * configuración y no un barrido por el CSS.
 *
 * Y no se puede resolver con `var(--danger)` directamente: Leaflet pinta los polígonos
 * poniendo `stroke` y `fill` como ATRIBUTOS de presentación del SVG, y ahí `var()` no se
 * evalúa —es sintaxis de CSS, no de SVG—. Así que el valor se lee del elemento raíz, que
 * es donde `themeCss` dejó los tokens de esta emergencia.
 *
 * Si el token faltara, `currentColor`: se hereda el color del texto y la zona se ve en un
 * gris legible en lugar de desaparecer. Sigue sin haber un hex escrito en ningún sitio.
 */
const TOKEN: Record<Severity, string> = {
  1: "--adm",
  2: "--warn",
  3: "--danger",
};

export function zoneColor(severity: Severity): string {
  if (typeof document === "undefined") return "currentColor";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(TOKEN[severity])
    .trim();
  return value || "currentColor";
}

/**
 * El relleno sube con la gravedad, y se queda bajo aunque suba.
 *
 * Debajo de la zona hay un mapa que la gente necesita leer —calles, nombres, sus propios
 * puntos de ayuda—. Una mancha al 40% marca muy bien el polígono y tapa justo aquello por
 * lo que alguien abrió el mapa.
 */
export function zoneFillOpacity(severity: Severity): number {
  return 0.1 + severity * 0.04;
}
