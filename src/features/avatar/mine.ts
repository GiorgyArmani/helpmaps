import { decodeAvatar, parseAvatar, type Avatar, type SpeciesId } from "@/domain/avatar";

/**
 * El avatar de quien tiene la sesión, de la mejor fuente que haya.
 *
 * 1. `profiles.avatar`, si ya llegó: es la fuente de verdad.
 * 2. El código de los metadatos de la sesión: está en el navegador desde el primer instante
 *    y es lo que deja a la barra dibujarlo sin esperar a la red.
 *
 * Los dos ya pasaron por el servidor, que comprobó el nivel; aquí sólo se filtra contra el
 * catálogo y contra las especies de ESTE país. Un país sin fauna devuelve `null` siempre y
 * su gente sigue con la inicial.
 */
export function myAvatar(
  species: readonly SpeciesId[],
  stored: unknown,
  sessionCode: string | null,
): Avatar | null {
  if (species.length === 0) return null;
  const fromDb = parseAvatar(stored, { species, level: 5 });
  if (fromDb) return fromDb;
  const fromSession = decodeAvatar(sessionCode);
  return fromSession && species.includes(fromSession.sp) ? fromSession : null;
}
