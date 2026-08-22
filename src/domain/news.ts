/**
 * The press bulletin an emergency publishes.
 *
 * ── WHY THE KEYWORDS ARE CONFIGURATION ──────────────────────────────────────
 *
 * The original filter crossed two hardcoded lists: emergency words ("sismo", "réplica",
 * "epicentro") and Venezuelan place names. It worked well precisely because it was
 * specific — a wire feed carries a hundred stories a day and maybe two are about this
 * emergency — and that specificity is exactly what makes it unusable anywhere else. A
 * flood in another country filtered through the states of Venezuela returns nothing.
 *
 * So both lists belong to the emergency. A deployment that declares none has no bulletin,
 * and the entry page shows no section for it — an empty news panel on a disaster map reads
 * as "nothing is being reported", which is worse than not offering it.
 */
export interface NewsFeed {
  id: string;
  name: string;
  url: string;
}

export interface NewsKeywords {
  /** Words that mean "this is about a disaster". */
  emergency: string[];
  /** Words that mean "this is about HERE" — places, the country's own name. */
  place: string[];
}

export interface NewsConfig {
  feeds: NewsFeed[];
  keywords: NewsKeywords;
  /** How often the cron regenerates. Reading is always free; generating is not. */
  refreshHours: number;
}

export const NEWS_OFF: NewsConfig = {
  feeds: [],
  keywords: { emergency: [], place: [] },
  refreshHours: 4,
};

function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().toLowerCase());
}

/** Read the `news` column. A malformed entry is dropped, never thrown. */
export function parseNewsConfig(value: unknown): NewsConfig {
  if (!value || typeof value !== "object") return NEWS_OFF;
  const o = value as Record<string, unknown>;

  const feeds: NewsFeed[] = [];
  const seen = new Set<string>();
  if (Array.isArray(o.feeds)) {
    for (const raw of o.feeds) {
      if (!raw || typeof raw !== "object") continue;
      const f = raw as Record<string, unknown>;
      const id = typeof f.id === "string" ? f.id.trim() : "";
      const name = typeof f.name === "string" ? f.name.trim() : "";
      const url = typeof f.url === "string" ? f.url.trim() : "";
      if (!id || !name || !url || seen.has(id)) continue;
      // A feed is fetched by the SERVER, not the browser, so plain http is not a mixed
      // content problem here. Several established outlets still publish their RSS over
      // http and dropping them would quietly shrink the bulletin.
      if (!/^https?:\/\//.test(url)) continue;
      seen.add(id);
      feeds.push({ id, name, url });
    }
  }

  const kw = (o.keywords ?? {}) as Record<string, unknown>;
  const refresh = typeof o.refreshHours === "number" && o.refreshHours > 0 ? o.refreshHours : 4;

  return {
    feeds,
    keywords: { emergency: strings(kw.emergency), place: strings(kw.place) },
    refreshHours: refresh,
  };
}

/** True when this emergency has a bulletin at all. */
export function newsEnabled(config: NewsConfig): boolean {
  return config.feeds.length > 0;
}

/**
 * Does this headline belong in the bulletin?
 *
 * Both lists have to hit: something that says a disaster happened AND something that says
 * it happened here. One alone is what fills a Venezuelan bulletin with earthquakes in
 * Japan, or with every routine story that mentions Caracas.
 *
 * With no place list declared, the emergency word alone decides — the honest degradation
 * for a deployment that has not finished configuring, and it errs toward showing too much
 * rather than showing nothing.
 */
export function isRelevant(text: string, keywords: NewsKeywords): boolean {
  const hay = text.toLowerCase();
  const emergency = keywords.emergency.some((k) => hay.includes(k));
  if (!emergency) return false;
  if (keywords.place.length === 0) return true;
  return keywords.place.some((k) => hay.includes(k));
}
