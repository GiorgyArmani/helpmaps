import type { Center, CenterStatus } from "@/domain/types";
import { currentOffers, statusOf } from "@/domain/center";
import { levelFor } from "@/domain/badges";

/**
 * Las notificaciones: lo que cambió desde la última vez que esta persona miró.
 *
 * ── SE CALCULAN, NO SE GUARDAN ──────────────────────────────────────────────
 *
 * No hay tabla de notificaciones, y es deliberado. Todo lo que hay que contar ya existe y
 * esta persona ya lo puede leer: su experiencia y sus medallas (`contributions`,
 * `user_badges`), en qué quedó lo que envió, y lo que publican los puntos que guardó. Una
 * notificación es eso mismo, ordenado por fecha.
 *
 * La alternativa —una fila por persona cada vez que un punto publica algo— obliga a que la
 * base lea `favourites` para repartir, y `favourites` es la tabla que NADIE más lee, ni un
 * superadmin: quién sigue qué refugio no sale de la cuenta de su dueño. Calculando aquí, el
 * servidor sigue sin saber a quién le importa cada punto.
 *
 * Y es la misma decisión que el feed y «Cerca»: se cruza en el cliente con los puntos que
 * ya están en memoria.
 *
 * ── LO QUE ESTO NO PUEDE HACER ──────────────────────────────────────────────
 *
 * Avisar con la aplicación cerrada. Eso es un envío (correo o push), necesita que el
 * servidor sepa a quién avisar y es otra decisión, con su consentimiento aparte.
 */

/** Las dos mitades de lo que se pidió: lo tuyo, y lo de los puntos que sigues. */
export type NotifGroup = "progress" | "points";

export type NotifKind =
  | "level"
  | "badge"
  | "xp"
  | "submission"
  | "team"
  | "post"
  | "campaign"
  | "goal"
  | "event"
  | "offers"
  | "update";

/**
 * Una notificación, sin redactar. La vista pone las palabras: aquí sólo van los datos, para
 * que este archivo no sepa de idiomas.
 */
export interface Notif {
  id: string;
  group: NotifGroup;
  kind: NotifKind;
  /** Cuándo pasó. Ordena la lista y decide si es nueva. */
  at: string;
  /** El punto del que habla. `null` en las de progreso: ésas abren la cuenta. */
  centerId: string | null;
  /** El nombre del punto, tal como está en el mapa. */
  name: string;
  /** El texto propio de la novedad: el cuerpo de una publicación, el título de una campaña. */
  text: string;
  /** Experiencia ganada (`xp`) o acumulada al subir (`level`). */
  n: number;
  /** Lo que distingue dentro del tipo: la acción, la medalla, el nivel, el estado. */
  code: string;
  /** La fecha de una jornada, que no es la de su anuncio. */
  when: string | null;
}

/** Más viejo que esto ya no es una novedad: es historial, y vive en «Mi cuenta». */
export const NOTIF_WINDOW_DAYS = 30;
const MAX_ITEMS = 80;

export interface NotifSources {
  contributions: { kind: string; points: number; created_at: string }[];
  badges: { badge: string; awarded_at: string }[];
  submissions: { id: string; message: string; status: string; reviewedAt: string | null }[];
  volunteer: { id: string; status: string; reviewedAt: string | null } | null;
  posts: { id: string; location_id: string; body: string; created_at: string }[];
  campaigns: {
    id: string;
    location_id: string;
    title: string;
    status: string;
    starts_on: string;
    updated_at: string | null;
  }[];
  events: { id: string; location_id: string; title: string; starts_at: string; created_at: string }[];
}

export const EMPTY_SOURCES: NotifSources = {
  contributions: [],
  badges: [],
  submissions: [],
  volunteer: null,
  posts: [],
  campaigns: [],
  events: [],
};

export function buildNotifications(
  src: NotifSources,
  centers: Center[],
  saved: ReadonlySet<string>,
  now: number = Date.now(),
): Notif[] {
  const from = now - NOTIF_WINDOW_DAYS * 86_400_000;
  const out: Notif[] = [];

  /** Dentro de la ventana y no en el futuro: una campaña que abre mañana todavía no pasó. */
  const push = (item: Omit<Notif, "name" | "text" | "n" | "code" | "when"> & Partial<Notif>) => {
    const ms = Date.parse(item.at);
    if (!Number.isFinite(ms) || ms < from || ms > now) return;
    out.push({ name: "", text: "", n: 0, code: "", when: null, ...item });
  };

  // ── Tu progreso ─────────────────────────────────────────────────────────
  //
  // El nivel no está guardado en ninguna parte: sale de la experiencia. Así que subir de
  // nivel se detecta recorriendo las contribuciones en orden y mirando cuál cruzó un umbral.
  let xp = 0;
  const enOrden = [...src.contributions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  enOrden.forEach((c, i) => {
    const antes = levelFor(xp).level;
    xp += c.points;
    const ahora = levelFor(xp);
    push({
      id: `xp:${c.created_at}:${i}`,
      group: "progress",
      kind: "xp",
      at: c.created_at,
      centerId: null,
      n: c.points,
      code: c.kind,
    });
    if (ahora.level > antes) {
      push({
        id: `level:${ahora.level}`,
        group: "progress",
        kind: "level",
        at: c.created_at,
        centerId: null,
        n: xp,
        code: String(ahora.level),
      });
    }
  });

  for (const b of src.badges) {
    push({ id: `badge:${b.badge}`, group: "progress", kind: "badge", at: b.awarded_at, centerId: null, code: b.badge });
  }

  // Lo enviado sólo avisa cuando alguien lo revisó: «en revisión» no es una novedad.
  for (const s of src.submissions) {
    if (!s.reviewedAt || s.status === "pending") continue;
    push({
      id: `sub:${s.id}`,
      group: "progress",
      kind: "submission",
      at: s.reviewedAt,
      centerId: null,
      text: s.message,
      code: s.status,
    });
  }

  const v = src.volunteer;
  if (v?.reviewedAt && v.status !== "pending") {
    push({ id: `team:${v.id}`, group: "progress", kind: "team", at: v.reviewedAt, centerId: null, code: v.status });
  }

  // ── Los puntos que sigues ───────────────────────────────────────────────
  //
  // Sólo los que siguen en el mapa: un punto retirado no manda a nadie a ningún sitio, y
  // sus publicaciones tampoco salen en el feed por lo mismo.
  const byId = new Map(centers.filter((c) => saved.has(c.id)).map((c) => [c.id, c]));

  for (const p of src.posts) {
    const c = byId.get(p.location_id);
    if (!c) continue;
    push({ id: `post:${p.id}`, group: "points", kind: "post", at: p.created_at, centerId: c.id, name: c.name, text: p.body });
  }

  for (const k of src.campaigns) {
    const c = byId.get(k.location_id);
    if (!c) continue;
    // Una sola por campaña, la última que importa: que llegó a la meta gana a que abrió.
    const reached = k.status === "reached" && k.updated_at;
    push({
      id: `campaign:${k.id}:${reached ? "goal" : "open"}`,
      group: "points",
      kind: reached ? "goal" : "campaign",
      at: reached ? k.updated_at! : k.starts_on,
      centerId: c.id,
      name: c.name,
      text: k.title,
    });
  }

  for (const e of src.events) {
    const c = byId.get(e.location_id);
    if (!c) continue;
    push({
      id: `event:${e.id}`,
      group: "points",
      kind: "event",
      at: e.created_at,
      centerId: c.id,
      name: c.name,
      text: e.title,
      when: e.starts_at,
    });
  }

  // Lo que no es una tabla: sale de la ficha del punto, que ya está en memoria.
  for (const c of byId.values()) {
    const info = c.info;
    if (!info) continue;
    const offers = currentOffers(c, now);
    const offersAt = offers.length > 0 ? info.offers_confirmed_at : null;
    if (offersAt) {
      push({
        id: `offers:${c.id}:${offersAt}`,
        group: "points",
        kind: "offers",
        at: offersAt,
        centerId: c.id,
        name: c.name,
        text: offers.slice(0, 4).join(", "),
      });
    }
    // Confirmar lo disponible también mueve `updated_at`: si las dos fechas son la misma
    // edición, se cuenta una vez, y la de lo disponible dice más.
    const mismaEdicion =
      offersAt && info.updated_at && Math.abs(Date.parse(offersAt) - Date.parse(info.updated_at)) < 120_000;
    if (info.updated_at && !mismaEdicion) {
      const status: CenterStatus | null = statusOf(c);
      push({
        id: `update:${c.id}:${info.updated_at}`,
        group: "points",
        kind: "update",
        at: info.updated_at,
        centerId: c.id,
        name: c.name,
        code: status ?? "",
      });
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_ITEMS);
}

/** Cuántas son nuevas. Sin fecha de última visita, todas: nunca se abrió la bandeja. */
export function countUnread(items: Notif[], seenAt: string | null): number {
  if (!seenAt) return items.length;
  const seen = Date.parse(seenAt);
  return items.filter((n) => Date.parse(n.at) > seen).length;
}

export function isUnread(item: Notif, seenAt: string | null): boolean {
  return !seenAt || Date.parse(item.at) > Date.parse(seenAt);
}
