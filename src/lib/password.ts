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

export const MIN_PASSWORD = 12;

export const passwordTooShort = (p: unknown): boolean =>
  typeof p !== "string" || p.length < MIN_PASSWORD;

// No 0/O/1/l/I: this gets read off a screen and typed on a phone, sometimes dictated over
// the phone, and an ambiguous character there costs a support conversation.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * A temporary password for an account an admin is provisioning.
 *
 * 16 characters from a 31-symbol alphabet (~79 bits) grouped in fours for legibility. It
 * is generated rather than chosen because the person choosing it is not the person who
 * will use it: an admin inventing a password for someone else invents a weak one, and it
 * has to survive being read aloud when the welcome email lands in spam.
 */
export function generateTempPassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}
