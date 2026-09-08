import type { DictKey } from "@/i18n";

/**
 * Experiencia, niveles y medallas — en ese orden de importancia.
 *
 * ── QUÉ MANDA AQUÍ ──────────────────────────────────────────────────────────
 *
 * La EXPERIENCIA sube y no baja nunca, y de ella sale el NIVEL: eso es lo que una persona
 * enseña y lo que un comercio aliado mira para dar su beneficio. Las medallas son hitos —
 * «tu primera ayuda», «siete días distintos» — y no se canjean por nada. El día que se
 * canjeara una, dejarían de ser un recuerdo para ser una moneda, y una moneda que se gasta
 * al usarla no puede a la vez seguir contando lo que hiciste.
 *
 * Por eso la exp no se gasta jamás. Un nivel que baja al canjear un descuento castiga
 * exactamente a quien más ayudó.
 *
 * ── POR QUÉ EL CATÁLOGO ESTÁ AQUÍ Y NO EN UNA TABLA ─────────────────────────
 *
 * Una medalla es una REGLA («cinco confirmaciones»), no un dato. Puesta en una tabla,
 * cada clonación nueva tendría que sembrar filas para que existiera la medalla de la
 * primera ayuda, y una base sin sembrar daría una aplicación sin medallas y sin ningún
 * error que lo explicara. Lo que sí es un dato —quién ganó cuál y cuándo— vive en
 * `user_badges`.
 *
 * ── LO QUE SE MIDE, Y LO QUE NO ─────────────────────────────────────────────
 *
 * Todo se cuenta sobre `contributions`, que sólo lee su dueño. Las medallas se calculan
 * en el cliente con los datos de esa persona y se otorgan llamando a `award_badge`. Nada
 * de esto necesita saber DÓNDE estuvo nadie, y por eso ninguna regla mira `location_id`:
 * una medalla de «visitó cinco refugios distintos» sería justo el dato que este proyecto
 * decidió no publicar. Ver el encabezado de `db/06_reconocimiento.sql`.
 */

export type ContributionKind = "checkin" | "report" | "suggestion" | "donation" | "volunteer";

export interface Badge {
  /** Lo que se guarda en `user_badges.badge`. Estable: renombrar uno pierde el historial. */
  code: string;
  label: DictKey;
  hint: DictKey;
  /** Nombre del icono en `src/ui/icons.tsx`. */
  icon: "spark" | "heart" | "check" | "hand" | "volunteer" | "users";
  /** ¿Se la ha ganado ya? Recibe el recuento por tipo y el total de días activos. */
  earned: (c: Counts) => boolean;
}

export interface Counts {
  byKind: Record<ContributionKind, number>;
  total: number;
  /** La experiencia acumulada. Sube y no baja: ver la nota del encabezado. */
  xp: number;
  /** Días DISTINTOS con al menos una contribución. Mide constancia, no ráfagas. */
  days: number;
}

export const BADGES: Badge[] = [
  {
    code: "first",
    label: "badge.first",
    hint: "badge.first.hint",
    icon: "spark",
    earned: (c) => c.total >= 1,
  },
  {
    code: "confirmer",
    label: "badge.confirmer",
    hint: "badge.confirmer.hint",
    icon: "check",
    earned: (c) => c.byKind.report >= 5,
  },
  {
    code: "lookout",
    label: "badge.lookout",
    hint: "badge.lookout.hint",
    icon: "users",
    earned: (c) => c.byKind.report >= 25,
  },
  {
    code: "giver",
    label: "badge.giver",
    hint: "badge.giver.hint",
    icon: "heart",
    earned: (c) => c.byKind.donation >= 1,
  },
  {
    code: "hands",
    label: "badge.hands",
    hint: "badge.hands.hint",
    icon: "volunteer",
    earned: (c) => c.byKind.volunteer >= 3,
  },
  {
    // Constancia y no volumen: en un mapa de emergencia vale más quien vuelve siete días
    // que quien hace veinte cosas en una tarde y no aparece más.
    code: "steady",
    label: "badge.steady",
    hint: "badge.steady.hint",
    icon: "hand",
    earned: (c) => c.days >= 7,
  },
];

/**
 * Los niveles, y los umbrales de experiencia que los abren.
 *
 * ── ESTÁN CALIBRADOS PARA QUE HAGA FALTA SALIR DE CASA ──────────────────────
 *
 * Con la escala de `ACTION_POINTS`, llegar al último nivel sólo confirmando puntos desde
 * el teléfono exigiría 250 confirmaciones: inviable, y a propósito. Haciendo lo que este
 * producto quiere provocar —visitar puntos, escanear su código, aportar— son unas veinte
 * acciones, que es una temporada de alguien que de verdad está ayudando.
 *
 * Cinco niveles y no veinte: una escalera que no se acaba nunca deja de leerse como
 * progreso. Y es el número que verá un comercio aliado antes de dar un beneficio, así que
 * subir tiene que significar algo comprobado — por eso ninguna de las acciones caras se
 * puede reclamar desde el cliente.
 */
export const LEVELS: { level: number; from: number; label: DictKey }[] = [
  { level: 1, from: 0, label: "level.1" },
  // El primer salto es UNA acción física: quien va a un punto y escanea su código sube de
  // nivel esa misma tarde. Es el momento en el que se decide si vuelve.
  { level: 2, from: 10, label: "level.2" },
  { level: 3, from: 40, label: "level.3" },
  { level: 4, from: 100, label: "level.4" },
  { level: 5, from: 250, label: "level.5" },
];

/**
 * Lo que vale cada acción. ESPEJO de `contribution_points()` en
 * `db/06_reconocimiento.sql`, que es la fuente de verdad — aquí sólo se usa para poder
 * decirle a alguien cuánto suma algo ANTES de hacerlo.
 *
 * Si los dos dejan de coincidir manda la base, y lo que se vería aquí es una promesa
 * incumplida. Se cambian juntos.
 */
export const ACTION_POINTS: Record<ContributionKind, number> = {
  report: 1,
  suggestion: 3,
  checkin: 10,
  volunteer: 10,
  donation: 15,
};

export function levelFor(xp: number) {
  let current = LEVELS[0]!;
  for (const l of LEVELS) if (xp >= l.from) current = l;
  const next = LEVELS.find((l) => l.from > xp) ?? null;
  return {
    ...current,
    next,
    /** Cuánto falta para el siguiente. `null` en el último, que no tiene «falta». */
    toNext: next ? next.from - xp : null,
    /**
     * Cuánto se lleva recorrido del tramo actual, de 0 a 1. Es lo que dibuja la barra:
     * un número absoluto no dice si estás cerca, y el tramo de arriba es doce veces el
     * de abajo.
     */
    progress: next ? (xp - current.from) / (next.from - current.from) : 1,
  };
}

const EMPTY_BY_KIND: Record<ContributionKind, number> = {
  checkin: 0,
  report: 0,
  suggestion: 0,
  donation: 0,
  volunteer: 0,
};

/** Resume una lista de contribuciones en lo que las medallas necesitan saber. */
export function countContributions(
  rows: { kind: string; points: number; created_at: string }[],
): Counts {
  const byKind = { ...EMPTY_BY_KIND };
  const dias = new Set<string>();
  let xp = 0;
  for (const r of rows) {
    if (r.kind in byKind) byKind[r.kind as ContributionKind] += 1;
    xp += r.points;
    // La fecha en UTC, igual que el índice que impide contar dos veces el mismo día. Con
    // la zona local, alguien a las 23:00 vería dos días donde la base cuenta uno.
    dias.add(r.created_at.slice(0, 10));
  }
  return { byKind, total: rows.length, xp, days: dias.size };
}

/** Las que le tocan a alguien con estos recuentos. */
export function earnedBadges(counts: Counts): Badge[] {
  return BADGES.filter((b) => b.earned(counts));
}
