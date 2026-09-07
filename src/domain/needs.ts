/**
 * Lo que un punto recibe, como lista para elegir.
 *
 * ── DE DÓNDE SALE ESTA LISTA ────────────────────────────────────────────────
 *
 * No está inventada: sale de contar lo que los 476 puntos de la base venezolana tenían
 * escrito de verdad en `center_info.receives` y `needs` (2026-09-07). Los quince primeros
 * por frecuencia, en ese orden — agua (292 puntos), ropa (259), medicamentos (243),
 * alimentos (205)… Por eso el orden no es alfabético: lo que más se pide está arriba,
 * donde se toca sin desplazarse.
 *
 * Escribir cada insumo a mano, uno a uno y separado por comas, era la forma más lenta de
 * llenar el campo que más cambia de toda la ficha — y el que alguien actualiza desde un
 * teléfono, en un refugio, con prisa.
 *
 * ── POR QUÉ CLAVES Y NO PALABRAS ────────────────────────────────────────────
 *
 * Cada entrada es una clave del diccionario, así que la lista se traduce con el resto de
 * la aplicación y un país puede cambiar cualquier término desde `config/language.ts`
 * —«frazadas» en un sitio, «cobijas» en otro— sin tocar este archivo ni perder la
 * traducción al hacer merge con el repositorio base.
 *
 * ── LO QUE SE GUARDA ES LA PALABRA, NO LA CLAVE ─────────────────────────────
 *
 * `center_info.receives` es un array de TEXTO LIBRE y sigue siéndolo: estos chips sólo
 * ahorran teclear. Lo que se escribe a mano vale exactamente igual, y los cientos de
 * valores que ya hay en la base —incluidas sus variantes y sus erratas— se siguen
 * mostrando tal cual. Convertir esto en un enum obligaría a migrar todo lo publicado y
 * dejaría fuera el insumo que hace falta justo hoy.
 */

import type { DictKey } from "@/i18n";

export const RECEIVES_PRESETS: DictKey[] = [
  "supply.agua",
  "supply.ropa",
  "supply.medicamentos",
  "supply.alimentos",
  "supply.cobijas",
  "supply.higiene",
  "supply.insumosMedicos",
  "supply.panales",
  "supply.colchonetas",
  "supply.bebe",
  "supply.toallasSanitarias",
  "supply.sabanas",
  "supply.limpieza",
  "supply.linternas",
  "supply.herramientas",
];

/**
 * ¿Este valor ya está en la lista, sea cual sea su forma?
 *
 * Se compara sin acentos, sin mayúsculas y sin espacios de sobra porque lo que hay en la
 * base viene de años de gente escribiendo a mano: «Pañales», «panales» y « PAÑALES » son
 * lo mismo, y marcarlos como distintos llenaría el campo de duplicados que sólo se ven
 * al mirar dos veces.
 */
export function sameSupply(a: string, b: string): boolean {
  return normalizeSupply(a) === normalizeSupply(b);
}

export function normalizeSupply(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
