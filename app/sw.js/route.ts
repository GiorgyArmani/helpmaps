import { readFileSync } from "node:fs";
import path from "node:path";
import { swSource } from "@/lib/swSource";
import { BRAND, LANGUAGE, SITE } from "@/config";
import { translator } from "@/i18n";

/**
 * Serves the service worker with a per-build CACHE_VERSION baked in.
 *
 * It is generated rather than a static `/public/sw.js` for a concrete reason: a static
 * file is byte-identical across deploys, so the browser never reinstalls it and the
 * cached app shell freezes on an old build. Generating it per build changes the bytes
 * every deploy → the browser reinstalls → stale shell caches are discarded while the
 * DATA cache keeps working offline.
 */

export const dynamic = "force-static"; // identical for a whole build, recomputed each deploy

// Evaluated once per server process. A deploy always restarts the process, so even when
// BUILD_ID cannot be read this still changes on every deploy.
const BOOT_VERSION = "b" + Date.now().toString(36);

function cacheVersion(): string {
  try {
    return (
      readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || BOOT_VERSION
    );
  } catch {
    return BOOT_VERSION;
  }
}

export function GET() {
  // A clone that switched the PWA off should not have a worker quietly caching its
  // pages on every visitor's phone.
  if (!SITE.integrations.pwa.enabled) return new Response("", { status: 404 });

  const t = translator(LANGUAGE.default);

  return new Response(
    swSource(cacheVersion(), {
      lang: LANGUAGE.default,
      title: `${BRAND.short} — ${t("offline.offline")}`,
      body: t("offline.swBody"),
      retry: t("common.retry"),
    }),
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        // The worker itself must never be HTTP-cached, so a new version is always picked
        // up on the next visit (`updateViaCache: "none"` enforces the same).
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  );
}
