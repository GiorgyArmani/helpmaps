// Source for the offline-first service worker, served (with a per-build version
// injected) by app/sw.js/route.ts. It lives here — NOT in /public — on purpose:
// a static /public/sw.js would be byte-identical across deploys, so the browser
// would never reinstall it and the cached app shell would freeze on an old build.
// By generating it per build (CACHE_VERSION = buildId), every deploy produces new
// SW bytes → the browser reinstalls → stale shell/static caches are discarded, so
// the CODE stays fresh while the DATA cache keeps working offline.
//
// Policies:
//   - Navigations            → network-first, fall back to the cached app shell,
//                              and finally to a built-in offline page.
//   - /_next/static/*        → cache-first (immutable, content-hashed → safe).
//   - Other same-origin      → stale-while-revalidate.
//   - Supabase REST (reads)  → NETWORK-FIRST (fresh when online; cached only as an
//                              offline fallback — SWR here would hand an online user
//                              stale data on first load; the app's own localStorage
//                              cache already covers the offline case).
//   - Map tiles + Leaflet    → cache-first (areas viewed before render offline).

import { BRAND } from "@/config";

/** Copy for the offline fallback page, supplied by the caller from the deployment config. */
export interface OfflineCopy {
  lang: string;
  title: string;
  body: string;
  retry: string;
}

// The offline fallback page. Built as a plain string so it can be embedded into the
// generated SW via JSON.stringify (no nested-backtick escaping headaches). The words
// come from the deployment, so a clone gets its own brand and language here too.
function offlineHtml(c: OfflineCopy): string {
  return (
    '<!DOCTYPE html><html lang="' +
    c.lang +
    '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>" +
    c.title +
    "</title>" +
    "<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;" +
    "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f7f8f9;color:#16191f;text-align:center;padding:24px}" +
    ".b{max-width:340px}h1{font-size:18px;margin:0 0 8px}p{font-size:13px;color:#7b818c;line-height:1.5}" +
    "a{display:inline-block;margin-top:16px;background:#15181d;color:#fff;text-decoration:none;" +
    "padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600}</style></head>" +
    '<body><div class="b"><h1>' +
    c.title +
    "</h1>" +
    "<p>" +
    c.body +
    "</p>" +
    '<a href="/">' +
    c.retry +
    "</a></div></body></html>"
  );
}

/**
 * Build the service-worker JavaScript for a given cache version.
 * `version` is the Next.js buildId (changes every deploy) so old caches are
 * discarded automatically — no more manually bumping a "v3" string.
 *
 * The generated code deliberately avoids template literals (uses string
 * concatenation for cache names) so this outer template literal stays clean.
 */
export function swSource(version: string, copy: OfflineCopy): string {
  const OFFLINE_HTML = offlineHtml(copy);
  return (
    "/* HelpMaps — offline-first service worker (generated per build). */\n" +
    "const CACHE_VERSION = " +
    JSON.stringify(version) +
    ";\n" +
    "const SHELL_CACHE = 'helpmap-shell-' + CACHE_VERSION;\n" +
    "const STATIC_CACHE = 'helpmap-static-' + CACHE_VERSION;\n" +
    "const TILE_CACHE = 'helpmap-tiles-' + CACHE_VERSION;\n" +
    "const DATA_CACHE = 'helpmap-data-' + CACHE_VERSION;\n" +
    "const KEEP = [SHELL_CACHE, STATIC_CACHE, TILE_CACHE, DATA_CACHE];\n" +
    "const TILE_HOSTS = ['basemaps.cartocdn.com', 'unpkg.com'];\n" +
    // Built from config rather than written out: the ported list named `/ico.png`, an
    // asset that only exists in the original deployment's repo, so every install spent a
    // request 404ing and the icon this clone actually has was never cached. `allSettled`
    // below is why that failed quietly instead of breaking the whole install.
    "const PRECACHE = " +
    JSON.stringify(["/", "/login", "/manifest.webmanifest", "/icon", BRAND.logo].filter(Boolean)) +
    ";\n" +
    "const OFFLINE_HTML = " +
    JSON.stringify(OFFLINE_HTML) +
    ";\n" +
    "self.addEventListener('install', (event) => {\n" +
    "  self.skipWaiting();\n" +
    "  event.waitUntil(\n" +
    "    caches.open(SHELL_CACHE).then((cache) =>\n" +
    "      Promise.allSettled(PRECACHE.map((u) => cache.add(u))),\n" +
    "    ),\n" +
    "  );\n" +
    "});\n" +
    "self.addEventListener('activate', (event) => {\n" +
    "  event.waitUntil((async () => {\n" +
    "    const keys = await caches.keys();\n" +
    "    await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));\n" +
    "    await self.clients.claim();\n" +
    "  })());\n" +
    "});\n" +
    "function shouldCache(res) { return res && (res.ok || res.type === 'opaque'); }\n" +
    "async function staleWhileRevalidate(request, cacheName) {\n" +
    "  const cache = await caches.open(cacheName);\n" +
    "  const cached = await cache.match(request);\n" +
    "  const network = fetch(request).then((res) => {\n" +
    "    if (shouldCache(res)) cache.put(request, res.clone());\n" +
    "    return res;\n" +
    "  }).catch(() => null);\n" +
    "  return cached || (await network) || Response.error();\n" +
    "}\n" +
    "async function cacheFirst(request, cacheName) {\n" +
    "  const cache = await caches.open(cacheName);\n" +
    "  const cached = await cache.match(request);\n" +
    "  if (cached) return cached;\n" +
    "  const res = await fetch(request).catch(() => null);\n" +
    "  if (shouldCache(res)) cache.put(request, res.clone());\n" +
    "  return res || Response.error();\n" +
    "}\n" +
    "async function networkFirst(request, cacheName) {\n" +
    "  const cache = await caches.open(cacheName);\n" +
    "  try {\n" +
    "    const fresh = await fetch(request);\n" +
    "    if (shouldCache(fresh)) cache.put(request, fresh.clone());\n" +
    "    return fresh;\n" +
    "  } catch {\n" +
    "    const cached = await cache.match(request);\n" +
    "    return cached || Response.error();\n" +
    "  }\n" +
    "}\n" +
    "async function networkFirstShell(request) {\n" +
    "  const cache = await caches.open(SHELL_CACHE);\n" +
    "  try {\n" +
    "    const fresh = await fetch(request);\n" +
    "    if (shouldCache(fresh)) cache.put(request, fresh.clone());\n" +
    "    return fresh;\n" +
    "  } catch {\n" +
    "    return (await cache.match(request)) || (await cache.match('/')) ||\n" +
    "      new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });\n" +
    "  }\n" +
    "}\n" +
    "self.addEventListener('fetch', (event) => {\n" +
    "  const request = event.request;\n" +
    "  if (request.method !== 'GET') return;\n" +
    "  let url;\n" +
    "  try { url = new URL(request.url); } catch { return; }\n" +
    "  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;\n" +
    "  // App navigations → keep the last working shell available offline.\n" +
    "  if (request.mode === 'navigate') { event.respondWith(networkFirstShell(request)); return; }\n" +
    "  // Supabase public reads (PostgREST) → network-first so an ONLINE user always\n" +
    "  // gets fresh data; cache is only an offline fallback. Never touch auth.\n" +
    "  if (url.hostname.endsWith('.supabase.co')) {\n" +
    "    if (url.pathname.startsWith('/rest/v1/')) event.respondWith(networkFirst(request, DATA_CACHE));\n" +
    "    return;\n" +
    "  }\n" +
    "  // Map basemap tiles and Leaflet from CDN → cache-first.\n" +
    "  if (TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {\n" +
    "    event.respondWith(cacheFirst(request, TILE_CACHE)); return;\n" +
    "  }\n" +
    "  if (url.origin === self.location.origin) {\n" +
    "    // Immutable, content-hashed build assets → cache-first (fast + reliable;\n" +
    "    // a new build ships new hashed URLs, so this never serves a stale chunk).\n" +
    "    if (url.pathname.startsWith('/_next/static/')) event.respondWith(cacheFirst(request, STATIC_CACHE));\n" +
    "    // Everything else same-origin (icons, non-hashed assets) → SWR.\n" +
    "    else event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));\n" +
    "  }\n" +
    "});\n"
  );
}
