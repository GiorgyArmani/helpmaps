import { NextResponse, type NextRequest } from "next/server";
import { COUNTRY, FEATURES, IS_HUB } from "@/config";

/**
 * First-visit gate.
 *
 * Someone opening this deployment for the first time lands on `/inicio`, which asks the
 * one question that routes them ("do you need help, or do you want to help?") and
 * continues into the map from there.
 *
 * It runs ONCE per browser, on purpose. The primary user is someone searching for help
 * right now; making them clear a landing page on every reload — mid-search, on bad 3G —
 * would cost them time exactly when they have none. After the first pass a cookie is
 * dropped and the root serves the map directly, forever.
 *
 * The matcher is "/" only, so shared point links (`/c/<id>`) — the distribution model of
 * this whole project — are never intercepted. Neither are /docs, /admin or /api.
 *
 * File convention: `proxy.ts`, not `middleware.ts` — the latter is deprecated in Next 16
 * and warns at build time.
 */

// Namespaced per country: two clones opened in the same browser must not share the flag.
const SEEN_COOKIE = `helpmaps_entry_${COUNTRY.slug}`;
const SIX_MONTHS = 60 * 60 * 24 * 180;

/** Query params that make "/" a deep link rather than a first visit. */
const DEEP_LINKS = ["a", "mine", "c", "panel"];

export function proxy(req: NextRequest) {
  // The hub has its own landing, and a clone may switch the entry page off entirely.
  if (IS_HUB || !FEATURES.entryPage) return NextResponse.next();

  // A deep link already knows where it is going, so the orientation question has nothing
  // to add. `a=` comes from /inicio itself ("I want to help", "register my initiative");
  // without this it would bounce straight back. `mine=` is where an accepted center
  // invitation lands — usually on a phone that has never opened the site, which is
  // exactly who this gate catches — and sending a brand-new manager to the generic
  // landing instead of their initiative's onboarding is how the invitation got lost.
  // `c=` opens a point and `panel=` the staff panel.
  const params = req.nextUrl.searchParams;
  if (DEEP_LINKS.some((key) => params.has(key))) return NextResponse.next();

  // Already oriented → straight to the map.
  if (req.cookies.has(SEEN_COOKIE)) return NextResponse.next();

  // A router prefetch must not burn the one-time gate before the person clicks.
  if (req.headers.get("next-router-prefetch") || req.headers.get("purpose") === "prefetch") {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/inicio";
  // 307, not 308: "/" is still the real home of this app, and neither browsers nor
  // crawlers should cache this as a permanent move.
  const res = NextResponse.redirect(url, 307);
  res.cookies.set(SEEN_COOKIE, "1", {
    path: "/",
    maxAge: SIX_MONTHS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export const config = { matcher: "/" };
