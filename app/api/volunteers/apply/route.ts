import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { cleanName, cleanPhone, cleanText, isEmail } from "@/lib/sanitize";
import { createVolunteerRequest } from "@/data/staff";
import { notifyVolunteerRequest } from "@/lib/email";
import { isKnownRegion } from "@/config";

// A request to join the team. It creates NO account and grants NO access: an admin
// reviews it and provisions the account from the panel. That separation is deliberate —
// panel access means publishing live onto a map people act on.

export async function POST(req: Request) {
  const limit = rateLimit(`volunteer:${clientIp(req.headers)}`, 3);
  if (!limit.ok) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const name = cleanName(raw.name, 80);
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";

  if (!name || !isEmail(email)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const region = typeof raw.region === "string" && isKnownRegion(raw.region) ? raw.region : null;

  const sb = supabasePublic();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const request = {
    name,
    email,
    phone: cleanPhone(raw.phone) || null,
    profile: cleanText(raw.profile, 200) || null,
    motivation: cleanText(raw.motivation, 1200) || null,
    region,
  };

  try {
    await createVolunteerRequest(sb, request);
  } catch {
    return NextResponse.json({ error: "insert_failed" }, { status: 502 });
  }

  // Best-effort, and note it goes to the TEAM inbox only — never back to the address the
  // applicant typed. See the phishing note in src/lib/email.ts.
  void notifyVolunteerRequest(request);

  return NextResponse.json({ ok: true });
}
