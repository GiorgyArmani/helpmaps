import type { Center } from "@/domain/types";

/**
 * El sello «Verificada» de una organización (`db/19_seguir_y_verificada.sql`).
 *
 * Se gana cuando el equipo aprueba a un gestor —comprobar quién habla por un punto ya es
 * verificar la organización— y dura `VERIFIED_DAYS`. Pasado ese plazo sin que nadie del
 * equipo la vuelva a revisar, el sello se apaga solo: una verificación de hace un año dice
 * cómo era la organización entonces, no cómo es hoy, y un sello que no se puede perder no
 * vale nada.
 *
 * Se calcula aquí, en el cliente, sobre la fecha. No hay un proceso nocturno que lo quite:
 * la fecha ya lo dice todo, y así no hay una segunda verdad que se desincronice.
 */
export const VERIFIED_DAYS = 90;

/** A partir de aquí la cola de re-verificación la marca como «por vencer». */
export const VERIFY_WARN_DAYS = 75;

const DAY = 86_400_000;

export type VerifyState = "verified" | "expiring" | "expired" | "none";

/** Días desde la última verificación, o null si nunca se verificó. */
export function verifiedAgo(verifiedAt: string | null | undefined, now: number = Date.now()): number | null {
  if (!verifiedAt) return null;
  const t = Date.parse(verifiedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY));
}

export function verifyState(verifiedAt: string | null | undefined, now: number = Date.now()): VerifyState {
  const d = verifiedAgo(verifiedAt, now);
  if (d === null) return "none";
  if (d >= VERIFIED_DAYS) return "expired";
  if (d >= VERIFY_WARN_DAYS) return "expiring";
  return "verified";
}

/** ¿Se enseña el sello? «Por vencer» todavía lo es: el plazo no se cumplió. */
export function isVerified(center: Center | null | undefined, now: number = Date.now()): boolean {
  const s = verifyState(center?.info?.verified_at, now);
  return s === "verified" || s === "expiring";
}

/** Días que le quedan al sello (negativo si ya venció). */
export function verifyDaysLeft(verifiedAt: string | null | undefined, now: number = Date.now()): number | null {
  const d = verifiedAgo(verifiedAt, now);
  return d === null ? null : VERIFIED_DAYS - d;
}

/**
 * ¿Tiene sentido seguir este punto? Sí si alguien publica por él: tuvo gestor alguna vez
 * (`verified_at` sólo existe entonces) o es una iniciativa, que nace para contar lo que
 * hace. Un acopio importado sin gestor no va a publicar nada.
 */
export function isFollowable(center: Center): boolean {
  return Boolean(center.info?.verified_at) || center.type === "iniciativa" || center.type === "digital";
}
