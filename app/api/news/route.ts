import { currentEmergency } from "@/server/emergency";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchBulletins } from "@/data/news";
import { newsEnabled } from "@/domain/news";
import { cronAuthorized, regenerateBulletin } from "@/lib/news/regenerate";

/**
 * The press bulletin.
 *
 *   GET  — the published bulletins. Public, reads only, never generates.
 *   POST — regenerate. Gated by `X-Cron-Secret`, for an external scheduler or curl.
 *          Vercel's own scheduler cannot POST: it calls `GET /api/news/cron` instead.
 *
 * The split is the same one AcopioVE arrived at, and it is not about tidiness: generating
 * calls a paid model, so a browser must never be able to trigger it. A GET that generated
 * on a cache miss would let one refresh key spend money, and a crawler spend a lot of it.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const emergency = await currentEmergency();
  const sb = supabasePublic();
  if (!emergency || !sb) return json({ bulletins: [] });

  const bulletins = await fetchBulletins(sb, emergency.id);
  return json({
    enabled: newsEnabled(emergency.news),
    bulletins,
  });
}

export async function POST(req: Request) {
  // Cerrada sin secreto, no abierta: ver `cronAuthorized`.
  if (!cronAuthorized(req)) return json({ error: "unauthorized" }, 401);

  const emergency = await currentEmergency();
  if (!emergency) return json({ error: "no_emergency" }, 404);

  const url = new URL(req.url);
  const result = await regenerateBulletin(emergency, {
    dry: url.searchParams.get("dry") === "1",
    force: url.searchParams.get("force") === "1",
  });
  return json(result.body, result.status);
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
