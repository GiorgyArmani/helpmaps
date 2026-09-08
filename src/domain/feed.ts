import type { Campaign, Center, InitiativePost } from "@/domain/types";
import { distanceKm, hasCoords, hasNeed, isOpenPoint } from "@/domain/center";

/**
 * El feed: lo que está pasando cerca, en una sola lista.
 *
 * ── QUÉ ES Y QUÉ NO ES ──────────────────────────────────────────────────────
 *
 * No es una lista de puntos —eso ya es la pestaña «Cerca»— sino de COSAS QUE PASAN: una
 * iniciativa que cuenta lo que entregó, una campaña que abre con una meta, un punto que
 * dice qué le hace falta hoy. Tres formas distintas de la misma pregunta, «¿qué está
 * ocurriendo a mi alrededor?», que hasta ahora había que ir a buscar a tres sitios.
 *
 * ── DOS CARAS, PORQUE HAY DOS PERSONAS ─────────────────────────────────────
 *
 * `/inicio` lleva años preguntando lo mismo en su portada: ¿necesitas ayuda o quieres
 * ayudar? Son dos búsquedas opuestas y mezclarlas hace un feed que no sirve a ninguna de
 * las dos. Quien necesita algo quiere puntos ABIERTOS y qué ofrecen; quien quiere ayudar
 * quiere necesidades y campañas. El mismo material, ordenado al revés.
 *
 * ── EL ORDEN SE CALCULA AQUÍ, EN EL CLIENTE ────────────────────────────────
 *
 * La cercanía sale de `distanceKm` sobre los puntos que la aplicación ya tiene en
 * memoria, no de una consulta geográfica. Es la misma decisión que en `domain/nearby.ts`
 * y por la misma razón: una consulta «qué hay cerca de -10.6, -66.9» le cuenta al
 * servidor dónde está quien abre un mapa de refugios.
 */

/**
 * `need` es lo que un punto PIDE y `open` es lo que un punto OFRECE. Son las dos mitades
 * del mismo dato y van a caras opuestas del feed: confundirlas fue el primer error de
 * este archivo — «Necesito ayuda» enseñaba peticiones de ayuda, que es exactamente lo
 * contrario de lo que esa persona busca.
 */
export type FeedKind = "post" | "campaign" | "need" | "open";

export interface FeedItem {
  id: string;
  kind: FeedKind;
  /** El punto del que habla. Se usa para abrir su ficha de un toque. */
  center: Center;
  /**
   * Para ordenar por novedad. `null` cuando el punto no tiene ninguna fecha — cientos de
   * los importados no la tienen— y entonces NO se pinta: la primera versión usaba la
   * época Unix como reserva y el feed decía «hace 20704 días», que se lee como una
   * aplicación rota y no como un dato que falta.
   */
  at: string | null;
  post?: InitiativePost;
  campaign?: Campaign;
  /** Distancia en km si hay posición. `null` cuando no se ha dado permiso. */
  km: number | null;
  /** Guardado por esta persona: sube al principio. */
  saved: boolean;
}

export type FeedMode = "help" | "give";

/**
 * Cuánto pesa cada cosa al ordenar.
 *
 * No es un algoritmo: es una regla que se puede leer en voz alta. Lo guardado primero,
 * después lo cercano, y a igualdad, lo reciente. Cualquier cosa más lista que esto en un
 * mapa de emergencia es una caja negra decidiendo a qué refugio va la gente.
 */
/**
 * Cuánto queda en pie de lo que un punto declaró, según lo viejo que sea. 1 recién
 * confirmado, 0 a los sesenta días, y en línea recta entre medias.
 *
 * Existe porque `need` y `open` NO son cosas que alguien publicó: se deducen de la ficha
 * del punto, y valen exactamente lo que valga esa ficha. «Necesita ahora: pañales» escrito
 * hace dos meses no dice qué necesita ahora — dice qué necesitaba en julio.
 *
 * Sin fecha devuelve 0,3: no es «viejo», es «no se sabe», y eso no puede puntuar como algo
 * confirmado hoy ni hundirse como algo de hace dos meses.
 */
function vigencia(at: string | null): number {
  if (!at) return 0.3;
  const dias = (Date.now() - Date.parse(at)) / 86_400_000;
  if (!Number.isFinite(dias)) return 0.3;
  return Math.max(0, Math.min(1, 1 - dias / 60));
}

function score(item: FeedItem, mode: FeedMode): number {
  let s = 0;

  // Lo que esta persona guardó va primero, siempre. Es lo único que dijo que le importa.
  if (item.saved) s += 1_000_000;

  // Lo que la cara del feed está buscando. Los pesos son opuestos a propósito: es el
  // mismo material contestando dos preguntas contrarias.
  //
  // ⚠️ `need` y `open` se multiplican por su vigencia y las publicaciones y campañas NO.
  // No es una asimetría caprichosa: una campaña y una publicación llevan SU PROPIA fecha
  // —alguien las escribió ese día—, mientras que una necesidad hereda la del punto, que
  // puede llevar meses sin que nadie lo confirme.
  //
  // Medido el 2026-09-08 sobre la base real: de los 42 puntos con necesidad declarada, 40
  // llevaban más de un mes sin tocarse y 32 más de dos. Con el peso fijo que había, esos
  // 40 empataban a 5.000 con una campaña abierta esa misma semana y la empujaban al puesto
  // ~45 — había que hacer scroll ocho veces para verla. Justo lo contrario de lo que esta
  // cara del feed tiene que hacer: una campaña con meta concreta es lo más accionable que
  // hay para quien viene a ayudar, y era lo último que veía.
  if (mode === "give") {
    // Quien quiere ayudar: qué hace falta y dónde.
    if (item.kind === "need") s += 5_000 * vigencia(item.at);
    if (item.kind === "campaign") s += 4_000;
    if (item.kind === "post") s += 2_000;
  } else {
    // Quien necesita ayuda: qué hay abierto y qué se está repartiendo. Una campaña pide
    // dinero y una necesidad pide insumos: ninguna de las dos le sirve, y por eso no
    // suman nada aquí.
    if (item.kind === "open") s += 5_000 * vigencia(item.at);
    if (item.kind === "post") s += 3_000;
  }

  // Cercanía: hasta 2000 puntos, que se agotan a los 20 km. Sin posición, cero — y
  // entonces manda la novedad, que es la respuesta honesta a «no sé dónde estás».
  if (item.km !== null) s += Math.max(0, 2_000 - item.km * 100);

  // Novedad: hasta 1000, que se agotan en un mes. Sin fecha no suma, y así lo que nadie
  // ha confirmado nunca queda por detrás de lo que sí — que es lo correcto.
  if (item.at) {
    const dias = (Date.now() - Date.parse(item.at)) / 86_400_000;
    if (Number.isFinite(dias)) s += Math.max(0, 1_000 - dias * 33);
  }

  return s;
}

export interface BuildInput {
  centers: Center[];
  posts: InitiativePost[];
  campaigns: Campaign[];
  /** Posición de quien mira, si la dio. Nunca sale del navegador. */
  from: { lat: number; lng: number } | null;
  saved: Set<string>;
  mode: FeedMode;
}

/** Mezcla las tres fuentes en una lista ordenada. */
export function buildFeed({ centers, posts, campaigns, from, saved, mode }: BuildInput): FeedItem[] {
  const byId = new Map(centers.map((c) => [c.id, c]));
  const km = (c: Center): number | null =>
    from && hasCoords(c) ? distanceKm(from, c) : null;

  const items: FeedItem[] = [];

  for (const post of posts) {
    const center = byId.get(post.location_id);
    // Un punto que ya no está en el mapa —retirado, desactivado— no aparece en el feed
    // aunque su publicación siga en la base: mandaría gente a una puerta que se cerró.
    if (!center) continue;
    items.push({
      id: `post:${post.id}`,
      kind: "post",
      center,
      at: post.created_at,
      post,
      km: km(center),
      saved: saved.has(center.id),
    });
  }

  for (const campaign of campaigns) {
    const center = byId.get(campaign.location_id);
    if (!center) continue;
    items.push({
      id: `campaign:${campaign.id}`,
      kind: "campaign",
      center,
      at: campaign.updated_at ?? campaign.starts_on,
      campaign,
      km: km(center),
      saved: saved.has(center.id),
    });
  }

  // Las dos mitades que no son una tabla: salen de los puntos que ya están en memoria.
  for (const center of centers) {
    const at = center.info?.last_confirmed_at ?? center.info?.updated_at ?? null;

    if (mode === "give" && hasNeed(center)) {
      // Lo que este punto PIDE. Sólo para quien viene a ayudar.
      items.push({
        id: `need:${center.id}`,
        kind: "need",
        center,
        at: center.info?.updated_at ?? at,
        km: km(center),
        saved: saved.has(center.id),
      });
    }

    if (mode === "help" && isOpenPoint(center)) {
      // Lo que este punto OFRECE, y sólo si está ABIERTO. Mandar a alguien que necesita
      // ayuda a una puerta cerrada es el error que este proyecto más evita — por eso
      // aquí no basta con que el punto exista.
      items.push({
        id: `open:${center.id}`,
        kind: "open",
        center,
        at,
        km: km(center),
        saved: saved.has(center.id),
      });
    }
  }

  return items.sort((a, b) => score(b, mode) - score(a, mode));
}
