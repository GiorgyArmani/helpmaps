import "server-only";
import { createHash } from "node:crypto";
import { BRAND } from "@/config";

// Breach check for staff passwords — the other half of the policy in `src/lib/password.ts`,
// because length alone does not stop "contraseña123456".
//
// Supabase ships a leaked-password check, but only on paid plans. This does the same
// thing against Have I Been Pwned's Pwned Passwords range API, which is free and needs
// no API key.
//
// PRIVACY — this is the whole reason it is safe to call an external service with
// something derived from a password. It uses k-anonymity: the password is SHA-1'd here
// and only the FIRST FIVE hex characters of that hash leave this server. HIBP replies
// with every breached suffix sharing that prefix (hundreds of them) and the comparison
// happens locally. The password never leaves, the full hash never leaves, and HIBP cannot
// tell which candidate was ours. `Add-Padding` makes every response the same size, so an
// observer learns nothing from its length either.
//
// SHA-1 here protects nothing — it is only the lookup key HIBP's corpus is indexed by.
// Actual password storage is Supabase Auth's (bcrypt), untouched by this.
//
// FAILS OPEN, deliberately. If HIBP is unreachable or slow the password is allowed and
// the event is logged. This is an emergency platform: blocking someone from being given
// access at 3am because a third-party API is down causes more harm than the weak password
// it might have caught. The 12-character floor still applies either way.

const HIBP_RANGE = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 2500;

export async function isPwnedPassword(password: string): Promise<boolean> {
  try {
    const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const res = await fetch(HIBP_RANGE + prefix, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": `${BRAND.short.replace(/\s+/g, "")}-password-check`,
      },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[password] HIBP returned ${res.status}; allowing it`);
      return false;
    }

    for (const line of (await res.text()).split("\n")) {
      const [hash, countRaw] = line.trim().split(":");
      if (hash !== suffix) continue;
      // Padded entries are real-looking hashes with a count of 0 — decoys, not hits.
      return Number(countRaw ?? 0) > 0;
    }
    return false;
  } catch (err) {
    console.warn("[password] HIBP check unavailable; allowing it", err);
    return false; // fail open — see the note above
  }
}
