import { NextResponse, after } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { cleanName, cleanText } from "@/lib/sanitize";
import { createSubmission } from "@/data/staff";
import { notifySubmission } from "@/lib/email";
import type { SubmissionKind } from "@/domain/types";

// Public write surface: a suggestion for a point that is missing from the map.
//
// It goes through a route rather than straight from the browser to Supabase for one
// reason — rate limiting. RLS already allows an anonymous insert of a pending row, but
// nothing in RLS stops a console loop from filling the moderation queue with garbage
// until the team can no longer see the real reports.

const KINDS: SubmissionKind[] = ["center", "initiative", "need", "other"];

export async function POST(req: Request) {
  const limit = rateLimit(`suggest:${clientIp(req.headers)}`, 10);
  if (!limit.ok) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const message = cleanText(raw.message, 2000);
  if (message.length < 10) {
    return NextResponse.json({ error: "message_too_short" }, { status: 400 });
  }

  const kind = KINDS.includes(raw.kind as SubmissionKind)
    ? (raw.kind as SubmissionKind)
    : "center";

  const sb = supabasePublic();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const submission = {
    kind,
    message,
    name: cleanName(raw.name, 80) || null,
    // A contact may legitimately be an email, a phone or a handle, so it is cleaned as
    // text rather than forced into one shape and rejected.
    contact: cleanText(raw.contact, 120) || null,
    payload: null,
  };

  try {
    await createSubmission(sb, submission);
  } catch {
    return NextResponse.json({ error: "insert_failed" }, { status: 502 });
  }

  // Best-effort: the row is already saved and visible in the staff panel, so a mail
  // server having a bad day must not turn a successful submission into an error.
  //
  // `after()` rather than a bare floating promise. On a serverless host the instance can
  // be frozen the moment the response is returned, and an SMTP handshake takes seconds —
  // so `void send()` means the notification is racing the runtime and usually loses. This
  // keeps the send off the response's critical path AND guarantees it runs.
  after(() => notifySubmission(submission));

  return NextResponse.json({ ok: true });
}
