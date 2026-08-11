// Per-IP fixed-window limiter for public write endpoints.
//
// ⚠️ In-memory. That is correct for a single long-lived container and WRONG for
// serverless, where each instance keeps its own counter and a burst spread across
// instances slips through. If this clone deploys to Vercel or similar, put a shared
// store (Upstash/Redis) or the platform's own firewall in front and treat this as a
// second line rather than the only one.
//
// Why it exists at all: a `fetch()` loop pasted into a browser console is enough to
// flood a team inbox or fill a moderation queue with garbage. That happened on the first
// deployment.

interface Bucket {
  count: number;
  resetAt: number;
}

const BUCKETS = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets — goes straight into `Retry-After`. */
  retryAfter: number;
  limit: number;
}

export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const existing = BUCKETS.get(key);

  if (!existing || existing.resetAt <= now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0, limit };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  // Opportunistic sweep so an unbounded key space (every IP that ever called) cannot
  // grow the map forever.
  if (BUCKETS.size > 5000) {
    for (const [k, b] of BUCKETS) if (b.resetAt <= now) BUCKETS.delete(k);
  }

  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfter,
    limit,
  };
}

/**
 * Client IP from the proxy headers.
 *
 * `x-forwarded-for` is caller-controllable unless a trusted proxy rewrites it, so the
 * LAST hop is used rather than the first. Behind Cloudflare, `cf-connecting-ip` is the
 * reliable one and is preferred when TRUST_CF_IP is set.
 */
export function clientIp(headers: Headers): string {
  if (process.env.TRUST_CF_IP === "true") {
    const cf = headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return "unknown";
}

/** 429 with the headers a well-behaved client needs to back off. */
export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(result.retryAfter),
      "x-ratelimit-limit": String(result.limit),
      "x-ratelimit-remaining": "0",
    },
  });
}
