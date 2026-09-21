import { NextResponse, after } from "next/server";
import { supabasePublic, supabaseServer } from "@/lib/supabase/server";
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

  // Con sesión, la postulación es de ESA cuenta: el correo sale de auth y no del cuerpo
  // —no se le pide a quien ya lo dio al registrarse, ni se acepta otro distinto— y
  // `user_id` va en la fila. Sin `user_id` el índice de una-viva-por-cuenta ignora la
  // fila (los únicos ignoran nulos) y la misma persona podía postularse sin fin.
  const session = await supabaseServer();
  const { data: auth } = session ? await session.auth.getUser() : { data: { user: null } };
  const user = auth.user;

  const name = cleanName(raw.name, 80);
  const email = user?.email
    ? user.email.trim().toLowerCase()
    : typeof raw.email === "string"
      ? raw.email.trim().toLowerCase()
      : "";

  if (!name || !isEmail(email)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const region = typeof raw.region === "string" && isKnownRegion(raw.region) ? raw.region : null;

  const sb = user ? session : supabasePublic();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  if (user) {
    // Pendiente o aprobada: no hay nada que volver a pedir. Rechazada sí deja volver,
    // igual que el índice. Se lee con la sesión: `volunteer_requests_read` deja ver la propia.
    const { data: prev } = await sb
      .from("volunteer_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending", "approved"])
      .limit(1);
    if (prev && prev.length > 0) {
      return NextResponse.json({ error: "already_applied" }, { status: 409 });
    }
  }

  const request = {
    name,
    email,
    phone: cleanPhone(raw.phone) || null,
    profile: cleanText(raw.profile, 200) || null,
    motivation: cleanText(raw.motivation, 1200) || null,
    region,
  };

  try {
    await createVolunteerRequest(sb, { ...request, user_id: user?.id ?? null });
  } catch (err) {
    // Dos envíos a la vez pasan los dos la consulta de arriba; el índice único para al
    // segundo, y eso no es un fallo sino la misma respuesta.
    if ((err as { code?: string } | null)?.code === "23505") {
      return NextResponse.json({ error: "already_applied" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 502 });
  }

  // Best-effort, and note it goes to the TEAM inbox only — never back to the address the
  // applicant typed. See the phishing note in src/lib/email.ts.
  //
  // `after()`, not a floating promise: see the note in /api/suggest. A serverless
  // instance frozen at response time kills an in-flight SMTP send.
  after(() => notifyVolunteerRequest(request));

  return NextResponse.json({ ok: true });
}
