// El voluntariado: lo que una persona sabe hacer, cuándo puede, y lo que le falta a un
// evento (db/16_voluntariado.sql).
//
// El catálogo vive aquí y no en la base: añadir un oficio no debería pedir una migración.
// La base sólo acota el tamaño, y un valor que esta lista no conoce simplemente no se
// pinta — así una versión vieja de la app abierta en un teléfono no se rompe con uno nuevo.
//
// Son pocos a propósito. Un catálogo de cuarenta oficios se rellena marcando todo o nada;
// doce se leen de un vistazo, y son los que una organización pequeña de verdad busca.

export const SKILLS = [
  "health",
  "cooking",
  "logistics",
  "driving",
  "building",
  "care",
  "psych",
  "teaching",
  "comms",
  "tech",
  "legal",
  "languages",
] as const;

export type Skill = (typeof SKILLS)[number];

export const AVAILABILITY = ["weekdays", "evenings", "weekends", "emergencies"] as const;

export type Availability = (typeof AVAILABILITY)[number];

/**
 * Las cuatro formas de ayudar que un evento puede pedir. Es un conjunto cerrado —la base
 * lo valida entero— porque cada una lleva su propio icono y su propia frase en la ficha.
 */
export const EVENT_NEEDS = ["hands", "skills", "in_kind", "spread"] as const;

export type EventNeed = (typeof EVENT_NEEDS)[number];

const known = <T extends string>(list: readonly T[]) => {
  const set = new Set<string>(list);
  return (value: unknown): T[] =>
    Array.isArray(value) ? (value.filter((v) => typeof v === "string" && set.has(v)) as T[]) : [];
};

/** Lo que llega de la base, filtrado a lo que esta versión sabe pintar. */
export const toSkills = known(SKILLS);
export const toAvailability = known(AVAILABILITY);
export const toEventNeeds = known(EVENT_NEEDS);

/** Pedir manos u oficios ES pedir voluntarios: así se mantiene la columna de antes. */
export function needsVolunteers(needs: readonly EventNeed[]): boolean {
  return needs.includes("hands") || needs.includes("skills");
}

/**
 * Los oficios que un evento pide y esta persona tiene. Vacío si el evento no pide oficios,
 * aunque la lista `skills` tenga algo guardado de antes: lo que manda es `needs`.
 */
export function matchingSkills(
  needs: readonly EventNeed[],
  wanted: readonly Skill[],
  mine: readonly Skill[],
): Skill[] {
  if (!needs.includes("skills") || mine.length === 0) return [];
  const have = new Set(mine);
  return wanted.filter((s) => have.has(s));
}
