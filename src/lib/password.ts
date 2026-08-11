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

// REMOVED: `generateTempPassword`. Accounts are no longer provisioned with a password
// somebody else invented and mailed — `provision()` creates the account with none and
// emails a single-use `generateLink` recovery URL, so the volunteer chooses their own and
// no credential ever sits in an inbox. Do not bring it back: a generated password in
// email is permanent, forwardable, and crosses servers we do not control.
