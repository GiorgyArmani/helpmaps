import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { MIN_PASSWORD_PUBLIC, publicPasswordTooShort } from "@/lib/password";
import { isPwnedPassword } from "@/lib/passwordBreach";
import { cleanDisplayName, displayNameInvalid } from "@/domain/account";

/**
 * Crear la cuenta DESDE una invitación a gestionar un punto.
 *
 *   GET  ?t=<token>                          →  { place, email }
 *   POST { token, displayName, password }    →  { ok, email }
 *
 * ── POR QUÉ NO BASTA CON `/registro` ────────────────────────────────────────
 *
 * El registro normal manda un segundo correo para confirmar la dirección, y el enlace de
 * ese correo aterriza donde Supabase quiere, no donde pedimos: en el mapa. Quien venía a
 * gestionar su punto acababa en el flujo de una persona cualquiera, con la invitación
 * perdida por el camino. Dos correos y una pérdida de contexto para alguien a quien
 * acabamos de darle las llaves de su iniciativa.
 *
 * ── POR QUÉ AQUÍ SÍ SE PUEDE CONFIRMAR EL CORREO SIN MANDAR OTRO ────────────
 *
 * Cuando la invitación nombra un correo, el token de 256 bits se mandó A ESA dirección.
 * Tenerlo es la misma prueba de que el correo es tuyo que pinchar un enlace de
 * confirmación — es, literalmente, un enlace de confirmación que llegó antes. Por eso
 * sólo vale para invitaciones CON correo: una sin correo viajó por WhatsApp y no prueba
 * nada sobre ninguna dirección, así que ésas siguen el registro normal.
 *
 * El correo NO lo elige quien llama: sale de la fila de la invitación. Así esta ruta no
 * puede crear una cuenta confirmada para una dirección que nadie probó tener.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *
 * No canjea la invitación. Eso lo sigue haciendo `accept_center_invite`, con la sesión de
 * la persona, que es la única puerta y la que valida todo. Esta ruta sólo deja la cuenta
 * lista para que la persona entre y la canjee.
 *
 * ── Y NO ES UN ORÁCULO DE CUENTAS ───────────────────────────────────────────
 *
 * Responde «ya existe» cuando ya existe, al revés que `/api/account/register`. Aquí no
 * filtra nada: sólo lo pregunta quien tiene un token secreto mandado a esa misma
 * dirección, y la única dirección que puede consultar es la de la invitación.
 */

const MAX_PER_IP = 10;

interface InviteRow {
  email: string | null;
  accepted_at: string | null;
  expires_at: string;
  locations: { name: string } | { name: string }[] | null;
}

type Lookup =
  | { ok: true; email: string | null; place: string }
  | { ok: false; error: "not_found" | "used" | "expired" | "not_configured" };

async function lookup(token: string): Promise<Lookup> {
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, error: "not_configured" };
  if (!/^[0-9a-f]{16,128}$/i.test(token)) return { ok: false, error: "not_found" };

  const { data } = await admin
    .from("center_invites")
    .select("email,accepted_at,expires_at,locations(name)")
    .eq("token", token)
    .maybeSingle<InviteRow>();

  if (!data) return { ok: false, error: "not_found" };
  if (data.accepted_at) return { ok: false, error: "used" };
  if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false, error: "expired" };

  const loc = Array.isArray(data.locations) ? data.locations[0] : data.locations;
  const email = data.email ? data.email.trim().toLowerCase() : null;
  return { ok: true, email, place: loc?.name ?? "" };
}

export async function GET(req: Request) {
  const limit = rateLimit(`invite-lookup:${clientIp(req.headers)}`, 30);
  if (!limit.ok) return tooManyRequests(limit);

  const token = new URL(req.url).searchParams.get("t") ?? "";
  const found = await lookup(token);
  if (!found.ok) {
    return NextResponse.json(
      { error: found.error },
      { status: found.error === "not_configured" ? 503 : 404 },
    );
  }
  return NextResponse.json({ place: found.place, email: found.email });
}

export async function POST(req: Request) {
  const limit = rateLimit(`invite-register:${clientIp(req.headers)}`, MAX_PER_IP);
  if (!limit.ok) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const raw = (body ?? {}) as Record<string, unknown>;
  const token = typeof raw.token === "string" ? raw.token.trim() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const displayName = cleanDisplayName(raw.displayName);

  if (displayNameInvalid(displayName)) {
    return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
  }
  if (publicPasswordTooShort(password)) {
    return NextResponse.json(
      { error: "password_too_short", min: MIN_PASSWORD_PUBLIC },
      { status: 400 },
    );
  }

  const found = await lookup(token);
  if (!found.ok) {
    return NextResponse.json(
      { error: found.error },
      { status: found.error === "not_configured" ? 503 : 404 },
    );
  }
  // Sin correo en la invitación no hay nada que pruebe la dirección: registro normal.
  if (!found.email) return NextResponse.json({ error: "needs_email" }, { status: 400 });

  if (await isPwnedPassword(password)) {
    return NextResponse.json({ error: "pwned_password" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data, error } = await admin.auth.admin.createUser({
    email: found.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error || !data?.user) {
    const exists =
      (error as { code?: string } | null)?.code === "email_exists" ||
      /already|registered|exists/i.test(error?.message ?? "");
    if (exists) return NextResponse.json({ error: "exists" }, { status: 409 });
    console.error("[invite-register] createUser:", error?.message ?? "sin usuario");
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  // Igual que en `/api/account/register`: el perfil se crea aquí, no con un trigger en
  // `auth`, que no vive en ninguna migración de este repo.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ user_id: data.user.id, display_name: displayName }, { onConflict: "user_id" });
  if (profileError) {
    console.error("[invite-register] no se pudo crear el perfil:", profileError.message);
  }

  return NextResponse.json({ ok: true, email: found.email });
}
