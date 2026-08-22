import { currentEmergency } from "@/server/emergency";
import { supabasePublic } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchBulletins, insertBulletin, lastBulletinAt } from "@/data/news";
import { collectHeadlines } from "@/lib/news/feeds";
import { buildBulletin } from "@/lib/news/bulletin";
import { newsEnabled } from "@/domain/news";

/**
 * The press bulletin.
 *
 *   GET  — the published bulletins. Public, reads only, never generates.
 *   POST — regenerate. Gated by `X-Cron-Secret`, called by a scheduler.
 *
 * The split is the same one AcopioVE arrived at, and it is not about tidiness: generating
 * calls a paid model, so a browser must never be able to trigger it. A GET that generated
 * on a cache miss would let one refresh key spend money, and a crawler spend a lot of it.
 */

export const dynamic = "force-dynamic";

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
  const secret = process.env.NEWS_CRON_SECRET;
  // Sin secreto configurado la ruta queda cerrada, no abierta. Un despliegue que olvidó
  // ponerlo se queda sin boletín; uno que quedara abierto se queda sin saldo.
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const emergency = await currentEmergency();
  if (!emergency) return json({ error: "no_emergency" }, 404);
  if (!newsEnabled(emergency.news)) return json({ error: "news_not_configured" }, 400);

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";

  const admin = supabaseAdmin();
  const reader = supabasePublic();

  // ¿Toca? El cron puede correr más seguido que el ciclo declarado sin que eso signifique
  // pagar otra síntesis: se pregunta antes de gastar.
  if (!force && !dry && reader) {
    const last = await lastBulletinAt(reader, emergency.id);
    if (last) {
      const hours = (Date.now() - last.getTime()) / 3_600_000;
      if (hours < emergency.news.refreshHours) {
        return json({ skipped: "too_soon", lastAt: last.toISOString(), hours: round(hours) });
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

  // Una corrida en seco devuelve lo que publicaría sin escribir ni gastar. Sirve para
  // comprobar que los medios responden y que el filtro deja pasar algo ANTES de encender
  // el cron sobre una emergencia recién configurada.
  if (dry) {
    return json({ dry: true, headlines: headlines.length, sources, preview: bulletin.summary });
  }

  if (!admin) return json({ error: "service_role_not_configured" }, 503);

  await insertBulletin(admin, emergency.id, bulletin, sources);
  return json({ ok: true, headlines: headlines.length, sources, model: bulletin.model });
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
