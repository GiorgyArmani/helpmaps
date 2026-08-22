import "server-only";
import type { Headline } from "@/lib/news/feeds";

/**
 * Turning the collected headlines into the bulletin people read.
 *
 * ── THE SYNTHESIS IS OPTIONAL, AND THAT IS THE POINT ────────────────────────
 *
 * With a model key configured, the headlines are summarised into a few paragraphs — which
 * is what AcopioVE publishes and what makes the bulletin worth opening rather than a
 * second inbox of links.
 *
 * Without a key, the same headlines are published grouped by outlet. That is not a
 * degraded feature waiting to be finished: a deployment that cannot or will not pay for a
 * model still gets a working press digest, and no part of this application should require
 * a paid dependency to show something true.
 */

const MODEL = process.env.OPENROUTER_NEWS_MODEL || "google/gemini-2.5-flash";
const MAX_TOKENS = Number(process.env.OPENROUTER_NEWS_MAX_TOKENS || 4096);
const MAX_HEADLINES = 60;

export interface Bulletin {
  summary: string;
  /** null when nothing wrote it — the digest below is not a model output. */
  model: string | null;
}

function digest(headlines: Headline[]): string {
  const bySource = new Map<string, Headline[]>();
  for (const h of headlines) {
    const list = bySource.get(h.sourceName);
    if (list) list.push(h);
    else bySource.set(h.sourceName, [h]);
  }

  const parts: string[] = [];
  for (const [source, items] of bySource) {
    parts.push(`### ${source}`);
    for (const h of items.slice(0, 8)) {
      const when = h.publishedAt
        ? new Date(h.publishedAt).toLocaleDateString("es", { day: "2-digit", month: "short" })
        : "";
      parts.push(`- [${h.title}](${h.link})${when ? ` · ${when}` : ""}`);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

function prompt(headlines: Headline[], context: { emergency: string; country: string }): string {
  const lines = headlines.slice(0, MAX_HEADLINES).map((h) => {
    const when = h.publishedAt ? ` (${h.publishedAt.slice(0, 10)})` : "";
    return `- [${h.sourceName}]${when} ${h.title}${h.summary ? ` — ${h.summary.slice(0, 240)}` : ""}`;
  });

  return [
    `Sos el editor de un boletín de prensa sobre ${context.emergency}, en ${context.country}.`,
    "",
    "A partir de los titulares de abajo, escribí un resumen breve en español neutro:",
    "",
    "- Entre tres y cinco párrafos cortos. Nada de listas de titulares.",
    "- Empezá por lo más importante para alguien afectado por la emergencia.",
    "- Atribuí cada afirmación al medio que la publicó.",
    "- Si dos medios se contradicen, decilo en vez de elegir uno.",
    "- No inventes cifras, nombres ni fechas que no estén abajo.",
    "- No uses emojis.",
    "- No escribas tiempos relativos como 'hace dos horas': van a quedar congelados.",
    "",
    "Titulares:",
    ...lines,
  ].join("\n");
}

/** Compose the bulletin, synthesising when a model is available. */
export async function buildBulletin(
  headlines: Headline[],
  context: { emergency: string; country: string },
): Promise<Bulletin> {
  if (headlines.length === 0) {
    return {
      summary:
        "No se encontraron noticias recientes y relevantes sobre la emergencia en los " +
        "medios configurados.",
      model: null,
    };
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { summary: digest(headlines), model: null };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: prompt(headlines, context) }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("respuesta vacía del modelo");
    return { summary: text, model: MODEL };
  } catch (err) {
    // El modelo falló o se quedó sin cuota. Se publica el resumen por medio igual: un
    // boletín sin síntesis sigue diciendo qué está pasando, y no publicar nada no.
    console.error("[news] la síntesis falló, se publica el resumen por medio:", err);
    return { summary: digest(headlines), model: null };
  }
}
