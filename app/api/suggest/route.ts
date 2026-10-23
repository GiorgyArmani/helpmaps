import { NextResponse, after } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { cleanName, cleanPhone, cleanText, cleanUrl, isEmail } from "@/lib/sanitize";
import { isKnownRegion, isTypeEnabled } from "@/config";
import { createSubmission } from "@/data/staff";
import { notifySubmission, sendOrgRegistrationReceived } from "@/lib/email";
import type { LocationType, SubmissionKind } from "@/domain/types";

// Public write surface: a suggestion for a point that is missing from the map.
//
// It goes through a route rather than straight from the browser to Supabase for one
// reason — rate limiting. RLS already allows an anonymous insert of a pending row, but
// nothing in RLS stops a console loop from filling the moderation queue with garbage
// until the team can no longer see the real reports.

const KINDS: SubmissionKind[] = ["center", "initiative", "need", "other"];

/**
 * The structured part of a "register my initiative" submission when it has no seat:
 * the regions it serves and how to reach it. Every field is re-validated here — region
 * codes against the config, the URL through `cleanUrl`, the handle to what Instagram
 * itself accepts — and capped, because this lands in a jsonb column the staff panel
 * renders. Anything else in the body's `payload` is dropped on the floor.
 */
function digitalPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.digital !== true) return null;
  const regions = Array.isArray(p.coverage_regions)
    ? p.coverage_regions
        .filter((x): x is string => typeof x === "string" && isKnownRegion(x))
        .slice(0, 40)
    : [];
  const municipalities = Array.isArray(p.coverage_municipalities)
    ? p.coverage_municipalities
        .map((x) => cleanText(x, 60))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const handle =
    typeof p.instagram === "string"
      ? p.instagram
          .trim()
          .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
          .replace(/^@/, "")
          .replace(/\/.*$/, "")
      : "";
  return {
    digital: true,
    coverage_regions: regions,
    coverage_municipalities: municipalities,
    website: cleanUrl(p.website) || null,
    instagram: /^[a-z0-9._]{1,30}$/i.test(handle) ? handle : null,
    whatsapp: cleanPhone(p.whatsapp) || null,
  };
}

/**
 * A registration from `/organizaciones`: the organisation's own data, split into fields
 * so the staff panel can publish it as a point and invite the contact to manage it. Same
 * rules as above — every field re-checked against the config, capped, the rest dropped.
 */
function orgPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.org !== true) return null;
  const type = typeof p.type === "string" && isTypeEnabled(p.type as LocationType) ? p.type : null;
  // `cleanText`, no `cleanName`: ése es para nombres de PERSONA y quita cifras y signos,
  // y «Comedor 23 de Enero» llegaba como «Comedor de Enero». Este nombre no viaja en
  // ningún correo a terceros; lo lee el equipo y lo corrige en el formulario si hace falta.
  const name = cleanText(p.name, 80);
  if (!type || name.length < 2) return null;
  return {
    org: true,
    name,
    type,
    region: typeof p.region === "string" && isKnownRegion(p.region) ? p.region : null,
    place: cleanText(p.place, 160) || null,
    notes: cleanText(p.notes, 600) || null,
  };
}

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

  const org = orgPayload(raw.payload);
  const contact = cleanText(raw.contact, 120) || null;
  // A registration from `/organizaciones` MUST bring an email: the acknowledgement, the
  // invitation to manage the point and everything after go there. A general suggestion
  // may still leave a phone or a handle.
  if (org && !isEmail(contact)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const submission = {
    kind,
    message,
    name: cleanName(raw.name, 80) || null,
    // A contact may legitimately be an email, a phone or a handle, so it is cleaned as
    // text rather than forced into one shape and rejected.
    contact: org && contact ? contact.toLowerCase() : contact,
    // Only an initiative can carry the digital hints; any other kind's payload is ignored.
    payload: org ?? (kind === "initiative" ? digitalPayload(raw.payload) : null),
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
  // Communication with the organisation starts here, not when the team gets to it.
  if (org && submission.contact) {
    const to = submission.contact;
    after(() => sendOrgRegistrationReceived({ to }));
  }

  return NextResponse.json({ ok: true });
}
