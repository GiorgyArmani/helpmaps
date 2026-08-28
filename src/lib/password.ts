// Staff password policy — single source of truth.
//
// Client-safe on purpose: a form may want to check the same rule before submitting, so
// this module stays free of node-only imports. The breach check needs an outbound
// request and lives in `src/lib/passwordBreach.ts` (server only).
//
// 12, not 8, because these are not ordinary accounts: a staff account publishes LIVE onto
// a map that people act on, with no review queue in front of it. Length is also the ONLY
// composition rule — no forced symbols or digits, per NIST SP 800-63B, which found such
// rules push people toward predictable patterns. Ask for a passphrase instead; it is
// easier to type on a phone in the field than a short scrambled string.
//
// Length alone does not stop "contraseña123456" (16 characters, and breached). That is
// what the HIBP check is for; the two are one policy.

/**
 * Mínimo para una cuenta del EQUIPO.
 *
 * 12, y no 8, porque éstas no son cuentas corrientes: una cuenta de equipo publica EN
 * VIVO sobre un mapa que la gente usa para decidir a dónde ir, sin cola de revisión
 * delante. La longitud es además la ÚNICA regla de composición — nada de símbolos ni
 * dígitos obligatorios, según NIST SP 800-63B, que encontró que esas reglas empujan a la
 * gente hacia patrones predecibles. Pide una frase; se teclea mejor en un teléfono, en la
 * calle, que una cadena corta y revuelta.
 */
export const MIN_PASSWORD = 12;

/**
 * Mínimo para una cuenta de PERSONA.
 *
 * 8. Una cuenta de persona guarda puntos, sigue lo que reportó y se postula: no publica
 * nada, y la RLS de `db/01_esquema.sql § 010_accounts` no le deja tocar el mapa. Pedirle doce
 * caracteres a alguien que sólo quiere marcar un refugio es fricción que cuesta cuentas y
 * no compra seguridad proporcionada al riesgo.
 *
 * Que sean DOS constantes y no una es lo que impide que abaratar la de la izquierda
 * abarate la de la derecha sin que nadie lo note. Y la comprobación contra contraseñas
 * filtradas (`passwordBreach.ts`) se aplica a las dos por igual: es la que de verdad
 * frena "12345678", que con ocho caracteres pasaría la longitud sin despeinarse.
 *
 * ⚠️ Al ASCENDER a alguien a voluntario hay que exigirle `MIN_PASSWORD`, no ésta: en ese
 * momento su cuenta empieza a publicar en vivo. El camino ya existe — la aprobación manda
 * un enlace de un solo uso a `/reset`, y esa página valida contra el mínimo del equipo.
 */
export const MIN_PASSWORD_PUBLIC = 8;

/** ¿Es demasiado corta para una cuenta de equipo? */
export const passwordTooShort = (p: unknown): boolean =>
  typeof p !== "string" || p.length < MIN_PASSWORD;

/** ¿Es demasiado corta para una cuenta de persona? */
export const publicPasswordTooShort = (p: unknown): boolean =>
  typeof p !== "string" || p.length < MIN_PASSWORD_PUBLIC;

// REMOVED: `generateTempPassword`. Accounts are no longer provisioned with a password
// somebody else invented and mailed — `provision()` creates the account with none and
// emails a single-use `generateLink` recovery URL, so the volunteer chooses their own and
// no credential ever sits in an inbox. Do not bring it back: a generated password in
// email is permanent, forwardable, and crosses servers we do not control.
