import { NextResponse } from "next/server";
import { FEATURES } from "@/config";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { cleanText, spamScore } from "@/lib/sanitize";
import { sendContactEmail, type ContactKind } from "@/lib/email";

/**
 * "Write to us": an organisation asking to be listed in the donations directory, or a
 * general message. It writes nothing to the database — the only output is one email to
 * the team inbox.
 *
 * That makes it the most abusable endpoint in the app: every accepted request costs an
 * SMTP send, so an unguarded version is a mail bomb and a way to burn the mailbox's
 * quota. Four guards, cheapest first:
 *
 *   1. Two rate-limit windows. A burst cap per minute AND an hourly cap, because a
 *      determined sender otherwise dribbles messages just under the per-minute limit all
 *      day and the inbox is unusable by morning.
 *   2. A honeypot field no human ever sees. Filled → answered 200 and dropped, so the
 *      bot has nothing to learn from.
 *   3. Dwell time. A form submitted in under three seconds was not typed by a person.
 *   4. A content score that TAGS the subject and still delivers (see `spamScore`).
 *
 * A message that fails 2 or 3 gets a 200 on purpose. Telling a script it was caught is
 * how it learns to adapt.
 */

const BURST_LIMIT = 5; // per minute per IP
const HOURLY_LIMIT = 8;
const HOUR_MS = 3_600_000;
const MIN_DWELL_MS = 3_000;
const SPAM_TAG_AT = 3;

const KINDS: ContactKind[] = ["donation", "general"];

export async function POST(req: Request) {
  // The form only exists where the donations module does; without it there is no
  // in-app path here, and an endpoint nobody uses should not stay open.
  if (!FEATURES.donations) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ip = clientIp(req.headers);
  const burst = rateLimit(`contact:${ip}`, BURST_LIMIT);
  const hourly = rateLimit(`contact-hour:${ip}`, HOURLY_LIMIT, HOUR_MS);
  if (!burst.ok || !hourly.ok) return tooManyRequests(burst.ok ? hourly : burst);

  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (typeof raw.hp === "string" && raw.hp.trim() !== "") {
    console.warn(`[contact] honeypot filled (ip=${ip}) — dropped`);
    return NextResponse.json({ ok: true });
  }
  if (typeof raw.elapsed === "number" && raw.elapsed >= 0 && raw.elapsed < MIN_DWELL_MS) {
    console.warn(`[contact] submitted in ${raw.elapsed}ms (ip=${ip}) — dropped`);
    return NextResponse.json({ ok: true });
  }

  const message = cleanText(raw.message, 5000);
  if (message.length < 10) return NextResponse.json({ error: "message_too_short" }, { status: 400 });

  const kind = KINDS.includes(raw.kind as ContactKind) ? (raw.kind as ContactKind) : "general";
  const name = typeof raw.name === "string" ? raw.name : "";
  const email = typeof raw.email === "string" ? raw.email : "";
  const images = Array.isArray(raw.images)
    ? raw.images.filter((x): x is string => typeof x === "string").slice(0, 4)
    : [];

  const suspicious = spamScore(message, name) >= SPAM_TAG_AT;
  if (suspicious) console.warn(`[contact] tagged as possible spam (ip=${ip})`);

  const sent = await sendContactEmail({
    kind,
    name,
    // Reply-to only. It never becomes a recipient — see the phishing note in lib/email.ts.
    replyTo: email,
    message,
    images,
    suspicious,
  });
  // Unlike a suggestion, there is no database row behind this: if the mail did not go
  // out, the message is gone, and saying "received" would be a lie the sender acts on.
  if (!sent) return NextResponse.json({ error: "email_unavailable" }, { status: 502 });

  return NextResponse.json({ ok: true });
}
