import { currentEmergency } from "@/server/emergency";
import { cronAuthorized, regenerateBulletin } from "@/lib/news/regenerate";

/**
 * GET /api/news/cron — the scheduler's door.
 *
 * Vercel Cron (see `vercel.json`) calls this once a day (Hobby plans only allow daily crons;
 * `refreshHours` still guards the cost) with a GET and, when the project has a `CRON_SECRET`
 * variable, an `Authorization: Bearer` header. It cannot send
 * a POST or a custom header, which is why `POST /api/news` alone never ran in production.
 *
 * One Vercel project per country, so each project's cron regenerates its own emergency:
 * the host is the project's production domain, and when it is not (a `*.vercel.app`
 * alias) the resolver falls back to the single active emergency of that database.
 *
 * Same money rule as the POST: the secret is required, and "too soon" costs nothing.
 */

export const dynamic = "force-dynamic";
// Twenty feeds plus a model call do not fit the default function budget.
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return json({ error: "unauthorized" }, 401);

  const emergency = await currentEmergency();
  if (!emergency) return json({ error: "no_emergency" }, 404);

  const url = new URL(req.url);
  const result = await regenerateBulletin(emergency, {
    dry: url.searchParams.get("dry") === "1",
    force: url.searchParams.get("force") === "1",
  });
  return json({ emergency: emergency.slug, ...result.body }, result.status);
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
