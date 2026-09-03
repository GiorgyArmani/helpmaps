import "server-only";
import { supabasePublic } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { insertBulletin, lastBulletinAt } from "@/data/news";
import { collectHeadlines } from "@/lib/news/feeds";
import { buildBulletin } from "@/lib/news/bulletin";
import { newsEnabled } from "@/domain/news";
import type { ResolvedEmergency } from "@/config/fromRow";

// Regenerating the press bulletin — the one piece of this module that costs money.
//
// Two callers share it: the original `POST /api/news` (an external scheduler, or a
// person with the secret and curl) and `GET /api/news/cron`, which is how Vercel's own
// scheduler calls in. Vercel only ever sends a GET, with `Authorization: Bearer`, so the
// POST alone left production without a bulletin for a week: nothing called it.

export type RegenerateResult =
  | { status: 400; body: { error: "news_not_configured" } }
  | { status: 503; body: { error: "service_role_not_configured" } }
  | { status: 200; body: Record<string, unknown> };

/**
 * Authorised when the caller presents the shared secret either way a scheduler can:
 *
 *   - `x-cron-secret: <NEWS_CRON_SECRET>` — the header this project always accepted.
 *   - `Authorization: Bearer <CRON_SECRET>` — what Vercel Cron sends when the project
 *     has a `CRON_SECRET` variable. The same value in `NEWS_CRON_SECRET` is accepted
 *     too, so one secret is enough.
 *
 * With no secret configured at all the answer is "no", never "anyone": a deployment that
 * forgot it goes without a bulletin, one left open goes without a balance.
 */
export function cronAuthorized(req: Request): boolean {
  const shared = process.env.NEWS_CRON_SECRET?.trim();
  const vercel = process.env.CRON_SECRET?.trim();
  if (!shared && !vercel) return false;

  const header = req.headers.get("x-cron-secret");
  if (shared && header === shared) return true;

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer) return false;
  return (Boolean(vercel) && bearer === vercel) || (Boolean(shared) && bearer === shared);
}

/**
 * Regenerate one emergency's bulletin, unless it is too soon.
 *
 * `force` skips the freshness check; `dry` collects and synthesises but writes nothing,
 * which is how you check that the feeds answer before switching a scheduler on.
 */
export async function regenerateBulletin(
  emergency: ResolvedEmergency,
  { dry = false, force = false }: { dry?: boolean; force?: boolean } = {},
): Promise<RegenerateResult> {
  if (!newsEnabled(emergency.news)) return { status: 400, body: { error: "news_not_configured" } };

  const admin = supabaseAdmin();
  const reader = supabasePublic();

  // ¿Toca? El cron puede correr más seguido que el ciclo declarado sin que eso signifique
  // pagar otra síntesis: se pregunta antes de gastar.
  if (!force && !dry && reader) {
    const last = await lastBulletinAt(reader, emergency.id);
    if (last) {
      const hours = (Date.now() - last.getTime()) / 3_600_000;
      if (hours < emergency.news.refreshHours) {
        return {
          status: 200,
          body: { skipped: "too_soon", lastAt: last.toISOString(), hours: round(hours) },
        };
      }
    }
  }

  const { headlines, sources } = await collectHeadlines(
    emergency.news.feeds,
    emergency.news.keywords,
  );

  const bulletin = await buildBulletin(headlines, {
    emergency: emergency.name,
    country: emergency.site.country.name,
  });

  if (dry) {
    return {
      status: 200,
      body: { dry: true, headlines: headlines.length, sources, preview: bulletin.summary },
    };
  }

  if (!admin) return { status: 503, body: { error: "service_role_not_configured" } };

  await insertBulletin(admin, emergency.id, bulletin, sources);
  return {
    status: 200,
    body: { ok: true, headlines: headlines.length, sources, model: bulletin.model },
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
