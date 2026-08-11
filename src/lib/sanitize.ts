// Input cleaning for public write surfaces. No server-only dependencies, so route
// handlers and client forms can share it.
//
// This is defence in depth, not the only defence: React escapes on render and Postgres
// is parameterised. What it actually buys us is data hygiene — the first deployment
// ended up with `<script>alert(1)</script>` sitting in its activity feed forever, and a
// display name that carried a URL became a link the moment a mail client rendered it.

/**
 * A display name: letters (accented), spaces, hyphens, apostrophes. Digits, angle
 * brackets, URLs and domains are stripped, so a name can never carry a link that a mail
 * or chat client would auto-linkify into a phishing target.
 */
export function cleanName(input: unknown, max = 80): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w.-]+\.[a-z]{2,}\b/gi, " ")
    .replace(/[^\p{L}\p{M}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Free text. Angle brackets go (no stored markup) and whitespace collapses, but URLs
 * STAY: someone reporting a shelter may legitimately cite a post or a map link, and
 * stripping it would lose the evidence the team needs to verify the point.
 */
export function cleanText(input: unknown, max = 2000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/**
 * A cheap spam heuristic for the public contact form.
 *
 * It returns a SCORE, and the route TAGS the subject rather than dropping the message.
 * That distinction is the whole design: this form is how an organisation asks to be
 * listed, and silently swallowing a real one because it mentioned a payment link costs
 * far more than a tagged message the team can filter out.
 */
const SPAM_PHRASES = [
  "seo",
  "backlink",
  "ranking",
  "guest post",
  "casino",
  "viagra",
  "cialis",
  "forex",
  "crypto",
  "bitcoin",
  "usdt",
  "click here",
  "haz clic",
  "clique aqui",
  "limited offer",
  "act now",
  "make money",
  "gana dinero",
  "ganhe dinheiro",
  "bit.ly",
  "tinyurl",
  "t.me/",
  "telegram.me",
];

export function spamScore(message: string, name?: string): number {
  const text = `${name ?? ""} ${message ?? ""}`.toLowerCase();
  let score = 0;
  const links = (text.match(/https?:\/\/|www\.|\.(?:tk|top|xyz|ru|cn|link|click)\b/g) ?? []).length;
  if (links >= 1) score += 1;
  if (links >= 2) score += 1; // several links is a far stronger signal than one
  for (const phrase of SPAM_PHRASES) if (text.includes(phrase)) score += 1;
  // Heavy Cyrillic/Greek/CJK where every language this base ships (es/en/pt) is Latin.
  // A clone deploying in another script must delete this line — it is the only
  // assumption of its kind in the file.
  const nonLatin = (text.match(/[Ѐ-ӿͰ-Ͽ一-鿿぀-ヿ]/g) ?? [])
    .length;
  if (nonLatin >= 6) score += 2;
  // A message that is essentially just a link.
  if (message.trim().length < 25 && links >= 1) score += 1;
  return score;
}

/** Loose but useful: rejects the obviously-not-an-address, accepts everything real. */
export function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Digits, spaces, dashes, parens and a leading "+". Empty when nothing survives. */
export function cleanPhone(input: unknown, max = 24): string {
  if (typeof input !== "string") return "";
  const cleaned = input.replace(/[^\d+\s()-]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  return /\d/.test(cleaned) ? cleaned : "";
}

/** http/https only — `javascript:` and `data:` never become an href. */
export function cleanUrl(input: unknown): string {
  if (typeof input !== "string") return "";
  const value = input.trim();
  if (!value) return "";
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}
