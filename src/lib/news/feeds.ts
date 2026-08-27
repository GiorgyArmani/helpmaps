import "server-only";
import { isRelevant, type NewsFeed, type NewsKeywords } from "@/domain/news";

/**
 * Fetching and filtering the press feeds.
 *
 * Ported from AcopioVE, which has been running it since the first day of the earthquake.
 * The parsing is deliberately regex over the XML rather than a parser dependency: these
 * are RSS 2.0 and Atom, the four fields that matter are the same in both, and a malformed
 * feed has to cost that feed rather than throw.
 */

export interface Headline {
  sourceId: string;
  sourceName: string;
  title: string;
  link: string;
  summary: string;
  /** ISO, or null when the feed's date is unparseable. */
  publishedAt: string | null;
}

export interface FeedResult {
  headlines: Headline[];
  /** What each source contributed, so a silent outage is visible instead of guessed at. */
  sources: { id: string; name: string; count: number; error?: string }[];
}

const MAX_PER_FEED = 15;
const TIMEOUT_MS = 12_000;

function clean(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>?/gm, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function field(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return clean(m?.[1]);
}

/** Atom puts the URL in an attribute; RSS puts it in the element body. */
function link(block: string): string {
  const rss = block.match(/<link>([\s\S]*?)<\/link>/);
  if (rss?.[1]) return clean(rss[1]);
  const atom = block.match(/<link[^>]*href="([^"]+)"/);
  return atom?.[1]?.trim() ?? "";
}

function isoDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchOne(feed: NewsFeed, keywords: NewsKeywords): Promise<{
  headlines: Headline[];
  entry: FeedResult["sources"][number];
}> {
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Varios medios bloquean a un lector que no se identifica.
        "user-agent": "HelpMaps/1.0 (+https://helpmaps.net)",
        // `Accept` explícito porque el fetch de Node no manda ninguno y algunos medios
        // negocian contenido. No es lo que arregla el 406 de los feeds de la ONU: eso es
        // un bloqueo antibot de su infraestructura, que responde
        // "Blocked due to bot activity" con un contacto para pedir que lo levanten. Se ve
        // en el error solo porque abajo se guarda el CUERPO de la respuesta y no nada más
        // el código.
        accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
      },
      // Siempre fresco: un boletín se genera cada pocas horas y servir titulares de una
      // corrida anterior sería peor que no generarlo.
      cache: "no-store",
    });
    if (!res.ok) {
      // Con el cuerpo, no solo el código. "HTTP 406" a secas no le dice nada a quien
      // opera el boletín; el medio casi siempre explica qué esperaba recibir.
      const body = await res.text().catch(() => "");
      const detail = body.replace(/\s+/g, " ").trim().slice(0, 140);
      return {
        headlines: [],
        entry: {
          id: feed.id,
          name: feed.name,
          count: 0,
          error: detail ? `HTTP ${res.status}: ${detail}` : `HTTP ${res.status}`,
        },
      };
    }

    const xml = await res.text();
    const blocks =
      xml.match(/<item[\s>][\s\S]*?<\/item>/g) ??
      xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) ??
      [];

    const headlines: Headline[] = [];
    for (const block of blocks.slice(0, MAX_PER_FEED)) {
      const title = field(block, "title");
      if (!title) continue;
      const summary = field(block, "description") || field(block, "summary");
      if (!isRelevant(`${title} ${summary}`, keywords)) continue;
      headlines.push({
        sourceId: feed.id,
        sourceName: feed.name,
        title,
        link: link(block),
        summary,
        publishedAt: isoDate(field(block, "pubDate") || field(block, "updated") || field(block, "published")),
      });
    }

    return { headlines, entry: { id: feed.id, name: feed.name, count: headlines.length } };
  } catch (err) {
    // Una fuente caída devuelve vacío y el resto sigue. Es la regla de todo el agregador
    // de AcopioVE y la razón por la que el boletín nunca se queda sin salir.
    return {
      headlines: [],
      entry: {
        id: feed.id,
        name: feed.name,
        count: 0,
        error: err instanceof Error ? err.message.slice(0, 120) : "error",
      },
    };
  }
}

/** Every relevant headline across the declared feeds, newest first. */
export async function collectHeadlines(
  feeds: NewsFeed[],
  keywords: NewsKeywords,
): Promise<FeedResult> {
  // En paralelo: son una docena de peticiones a servidores ajenos y en serie el boletín
  // tardaría más que el tiempo de vida de la función que lo genera.
  const results = await Promise.all(feeds.map((f) => fetchOne(f, keywords)));

  const headlines = results
    .flatMap((r) => r.headlines)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  return { headlines, sources: results.map((r) => r.entry) };
}
