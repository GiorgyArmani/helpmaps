/**
 * El avatar: un animal de la fauna del país, vestido por su dueño.
 *
 * Este archivo es el MODELO y no dibuja nada: lo comparten el servidor (que valida lo que
 * llega antes de guardarlo) y el navegador (que lo dibuja con `src/features/avatar/art.ts`).
 * Sin dependencias, para que la ruta de registro lo importe sin arrastrar React.
 *
 * ── QUÉ SE GUARDA ───────────────────────────────────────────────────────────
 *
 * Sólo identificadores de catálogo: especie, hábitat y una pieza con su color por zona.
 * Nada de texto libre, nada de dibujo. Todo lo que llega se filtra contra estas listas y lo
 * desconocido se descarta, así que en la base no puede entrar nada que no se pueda dibujar.
 *
 * ── LOS ESPECIALES LOS DECIDE EL SERVIDOR ───────────────────────────────────
 *
 * Los básicos son libres desde el primer día. Los especiales (chaleco, brazalete…) piden un
 * nivel, y ese nivel lo calcula el servidor con las contribuciones de la base, nunca con lo
 * que diga el navegador. Ver `app/api/account/avatar/route.ts` y `db/18_avatar.sql`.
 *
 * ── EL HÁBITAT NO ES DÓNDE VIVES ────────────────────────────────────────────
 *
 * Es el fondo del dibujo y lo elige la persona. No se deduce de su ubicación ni de su
 * estado: un avatar que delatara la región de alguien sería un dato de ubicación publicado.
 */

/** Todas las especies que el arte sabe dibujar. Cada país elige cuáles ofrece en su preset. */
export const SPECIES = [
  "turpial",
  "chiguire",
  "caiman",
  "frontino",
  "tonina",
  "jaguar",
  "palmero",
  "cardenalito",
  "perroagua",
  "anaconda",
  "guacamaya",
  "guacaverde",
  "guacazul",
  "morrocoy",
  "cachicamo",
  "perezatres",
  "perezados",
  "condor",
] as const;
export type SpeciesId = (typeof SPECIES)[number];

export const HABITATS = ["llanos", "andes", "tepuy", "caribe", "orinoco", "selva"] as const;
export type HabitatId = (typeof HABITATS)[number];

/** Una sola paleta para todas las piezas: ningún color es «de» nadie. */
export const COLORS = ["rojo", "amarillo", "azul", "verde", "morado", "rosado", "negro", "crema", "marron"] as const;
export type ColorId = (typeof COLORS)[number];

export const SLOTS = ["ropa", "cabeza", "cara", "cuello", "cuerpo", "marco"] as const;
export type Slot = (typeof SLOTS)[number];
/** Las zonas que la persona edita a mano. El marco no: llega solo con el nivel más alto. */
export const EDITABLE_SLOTS = ["ropa", "cabeza", "cara", "cuello", "cuerpo"] as const satisfies readonly Slot[];

export interface ItemDef {
  id: string;
  slot: Slot;
  /** Color por defecto. Sin él, la pieza tiene sus colores propios y no se puede teñir. */
  def?: ColorId;
  /** Nivel que la abre (1–5). Sin él, es básica: libre desde el primer día. */
  lock?: number;
}

/**
 * El catálogo. Los NOMBRES viven en el diccionario (`avatar.item.<id>`), no aquí.
 * Renombrar un `id` borra esa pieza de todos los avatares que la llevaban: son claves.
 */
export const ITEMS: readonly ItemDef[] = [
  // Ropa: siempre hay una puesta.
  { id: "lisa", slot: "ropa", def: "azul" },
  { id: "rayas", slot: "ropa", def: "rojo" },
  { id: "playera", slot: "ropa", def: "verde" },
  { id: "chaqueta", slot: "ropa", def: "morado" },
  { id: "pelotero", slot: "ropa" },
  { id: "vinotinto", slot: "ropa" },
  { id: "liqui", slot: "ropa" },
  { id: "chemise", slot: "ropa", def: "amarillo" },
  { id: "sueter", slot: "ropa", def: "verde" },
  { id: "vestido", slot: "ropa", def: "rosado" },
  { id: "flores", slot: "ropa", def: "azul" },
  { id: "joropo", slot: "ropa", def: "rojo" },
  // Cabeza
  { id: "gorra", slot: "cabeza", def: "azul" },
  { id: "gorro", slot: "cabeza", def: "rojo" },
  { id: "llanero", slot: "cabeza", def: "marron" },
  { id: "boina", slot: "cabeza", def: "negro" },
  { id: "panoleta", slot: "cabeza", def: "morado" },
  { id: "cintillo", slot: "cabeza", def: "verde" },
  { id: "cayena", slot: "cabeza", def: "rojo" },
  { id: "lazo", slot: "cabeza", def: "rosado" },
  { id: "corona", slot: "cabeza", def: "amarillo" },
  { id: "cogollo", slot: "cabeza" },
  { id: "audifonos", slot: "cabeza", def: "negro" },
  { id: "casco", slot: "cabeza", def: "amarillo" },
  // Cara
  { id: "lentes", slot: "cara", def: "negro" },
  { id: "lentessol", slot: "cara", def: "rojo" },
  { id: "corazon", slot: "cara", def: "rosado" },
  { id: "tapabocas", slot: "cara", def: "azul" },
  { id: "pecas", slot: "cara" },
  // Cuello
  { id: "bufanda", slot: "cuello", def: "amarillo" },
  { id: "panuelo", slot: "cuello", def: "rojo" },
  { id: "corbatin", slot: "cuello", def: "azul" },
  { id: "collar", slot: "cuello" },
  { id: "perlas", slot: "cuello" },
  { id: "medalla", slot: "cuello", def: "azul" },
  // Cuerpo
  { id: "morral", slot: "cuerpo", def: "rojo" },
  { id: "bolso", slot: "cuerpo", def: "marron" },
  { id: "cuatro", slot: "cuerpo" },
  { id: "maracas", slot: "cuerpo" },
  // Especiales: se ganan.
  { id: "tricolor", slot: "cabeza", lock: 2 },
  { id: "chaleco", slot: "cuerpo", lock: 3 },
  { id: "brazalete", slot: "cuerpo", lock: 4 },
  { id: "araguaney", slot: "marco", lock: 5 },
];

export function itemDef(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}

export interface Piece {
  id: string;
  /** Sólo en piezas que se tiñen. */
  c?: ColorId;
}

export interface Avatar {
  sp: SpeciesId;
  hab: HabitatId;
  ropa: Piece;
  cabeza?: Piece;
  cara?: Piece;
  cuello?: Piece;
  cuerpo?: Piece;
  marco?: Piece;
}

const DEFAULT_ROPA: Piece = { id: "lisa", c: "azul" };

/** El hábitat con el que se presenta cada especie si nadie elige otro. */
export const NATIVE_HABITAT: Record<SpeciesId, HabitatId> = {
  turpial: "llanos",
  chiguire: "llanos",
  caiman: "orinoco",
  frontino: "andes",
  tonina: "orinoco",
  jaguar: "selva",
  palmero: "llanos",
  cardenalito: "andes",
  perroagua: "llanos",
  anaconda: "llanos",
  guacamaya: "selva",
  guacaverde: "selva",
  guacazul: "selva",
  morrocoy: "llanos",
  cachicamo: "llanos",
  perezatres: "selva",
  perezados: "selva",
  condor: "andes",
};

const isSpecies = (v: unknown): v is SpeciesId => typeof v === "string" && (SPECIES as readonly string[]).includes(v);
const isHabitat = (v: unknown): v is HabitatId => typeof v === "string" && (HABITATS as readonly string[]).includes(v);
const isColor = (v: unknown): v is ColorId => typeof v === "string" && (COLORS as readonly string[]).includes(v);

/**
 * Las especies que ofrece un país, en su orden. Un id que el arte no conoce se descarta
 * (y `src/config/validate.ts` lo avisa al arrancar). Vacío = este país no tiene avatar.
 */
export function faunaOf(country: { fauna?: readonly string[] }): SpeciesId[] {
  return (country.fauna ?? []).filter(isSpecies);
}

/** El avatar de partida para una especie: su hábitat y una franela lisa. */
export function starterAvatar(sp: SpeciesId): Avatar {
  return { sp, hab: NATIVE_HABITAT[sp], ropa: { ...DEFAULT_ROPA } };
}

/**
 * Lo que llega (del navegador o de la base) convertido en un avatar válido, o `null`.
 *
 * - `species`: las que ofrece este país. Una especie fuera de la lista invalida el avatar
 *   entero: dibujar un animal que el país no ofrece sería un error de configuración.
 * - `level`: el nivel REAL de la persona. Una pieza que pide más se descarta en silencio
 *   (no se rechaza el avatar: perder el chaleco no es motivo para perder el animal).
 *
 * Una pieza en una zona que no es la suya, o con un color fuera de la paleta, se corrige o
 * se descarta. La ropa nunca falta.
 */
export function parseAvatar(
  raw: unknown,
  opts: { species: readonly string[]; level: number },
): Avatar | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  if (!isSpecies(src.sp) || !opts.species.includes(src.sp)) return null;

  const out: Avatar = {
    sp: src.sp,
    hab: isHabitat(src.hab) ? src.hab : NATIVE_HABITAT[src.sp],
    ropa: { ...DEFAULT_ROPA },
  };

  for (const slot of SLOTS) {
    const v = src[slot];
    if (!v || typeof v !== "object") continue;
    const p = v as Record<string, unknown>;
    const def = typeof p.id === "string" ? itemDef(p.id) : undefined;
    if (!def || def.slot !== slot) continue;
    if (def.lock && def.lock > opts.level) continue;
    const piece: Piece = { id: def.id };
    if (def.def) piece.c = isColor(p.c) ? p.c : def.def;
    out[slot] = piece;
  }
  // El marco no se elige en el creador: lo pone el servidor a quien llegó al último nivel
  // (`app/api/account/avatar`). Aquí sólo sobrevive si venía y el nivel lo permite.
  return out;
}

/**
 * Código corto para viajar en los metadatos de la sesión.
 *
 * La barra dibuja el avatar sin preguntarle a la red (ver `useSessionPeek`): lo lee del
 * token que ya está en el navegador. Ese token va en cada petición, así que el código es
 * compacto: `v1.especie.hábitat.ropa.cabeza.cara.cuello.cuerpo.marco`, con `pieza-color`
 * en cada zona y vacío donde no hay nada.
 *
 * Es una COPIA para dibujar. La fuente de verdad es `profiles.avatar`.
 */
export function encodeAvatar(a: Avatar): string {
  const piece = (p?: Piece) => (p ? (p.c ? `${p.id}-${p.c}` : p.id) : "");
  return ["v1", a.sp, a.hab, ...SLOTS.map((s) => piece(a[s]))].join(".");
}

/**
 * Del código corto al avatar, para DIBUJAR. No comprueba niveles: el código ya pasó por el
 * servidor antes de llegar a la sesión, y lo peor que puede hacer alguien que lo edite a
 * mano es verse con un chaleco en SU propia barra.
 */
export function decodeAvatar(code: unknown): Avatar | null {
  if (typeof code !== "string" || !code.startsWith("v1.")) return null;
  const [, sp, hab, ...rest] = code.split(".");
  const raw: Record<string, unknown> = { sp, hab };
  SLOTS.forEach((slot, i) => {
    const part = rest[i];
    if (!part) return;
    const [id, c] = part.split("-");
    raw[slot] = { id, c };
  });
  return parseAvatar(raw, { species: SPECIES, level: 5 });
}

/** Un avatar al azar entre lo que esta persona puede llevar («Sorpréndeme»). */
export function randomAvatar(species: readonly SpeciesId[], level: number, rnd: () => number = Math.random): Avatar {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const sp = pick(species.length ? species : SPECIES);
  const a: Avatar = { sp, hab: pick(HABITATS), ropa: { ...DEFAULT_ROPA } };
  for (const slot of EDITABLE_SLOTS) {
    if (slot !== "ropa" && rnd() < 0.45) continue;
    const ok = ITEMS.filter((i) => i.slot === slot && (!i.lock || i.lock <= level));
    if (!ok.length) continue;
    const it = pick(ok);
    a[slot] = it.def ? { id: it.id, c: pick(COLORS) } : { id: it.id };
  }
  if (level >= 5) a.marco = { id: "araguaney" };
  return a;
}
