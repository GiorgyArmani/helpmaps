import { NextResponse, after } from "next/server";
import { absoluteUrl } from "@/config";
import { isGate, requireStaff } from "@/lib/staffGate";
import { isEmail } from "@/lib/sanitize";
import { sendCenterInvite } from "@/lib/email";

/**
 * Invitar a alguien a gestionar un punto del mapa.
 *
 *   POST { locationId, email? }  →  { ok, token, url }
 *
 * ── QUIÉN PUEDE, Y QUIÉN LO DECIDE ─────────────────────────────────────────
 *
 * `requireStaff()` comprueba que quien llama es del equipo. QUÉ punto puede tocar no lo
 * decide esta ruta: el `insert` corre con la sesión del propio llamante, así que la
 * política `center_invites_staff_all` —`can_edit(emergency_id del punto)`— es la que
 * responde. Un voluntario de otra emergencia recibe un error de RLS, no un permiso.
 *
 * No hay service role en este camino. Repartir las llaves de un punto es exactamente el
 * permiso que no debe poder ejercerse saltándose las políticas.
 *
 * ── EL CORREO ES OPCIONAL ──────────────────────────────────────────────────
 *
 * Sin correo se devuelve el enlace y ya está: en Venezuela mucha coordinación va por
 * WhatsApp, y obligar a tener correo para recibir una invitación deja fuera a media
 * gente. Con correo, además, se manda.
 *
 * Cuando SÍ se da un correo, queda escrito en la invitación y `accept_center_invite` lo
 * comprueba: un enlace reenviado no convierte en gestor a quien lo reciba de rebote.
 */
export async function POST(req: Request) {
  const gate = await requireStaff();
  if (!isGate(gate)) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const locationId = typeof raw.locationId === "string" ? raw.locationId.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";

  if (!locationId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (email && !isEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  // El nombre del punto lo lee el SERVIDOR. Si viniera del cliente, el correo diría lo
  // que quisiera quien llama — y este correo sí lleva el nombre dentro.
  const { data: place, error: placeError } = await gate.sb
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .maybeSingle();
  if (placeError || !place) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data, error } = await gate.sb
    .from("center_invites")
    .insert({ location_id: locationId, email: email || null, invited_by: gate.uid })
    .select("token")
    .maybeSingle();

  if (error || !data?.token) {
    // Lo más probable es RLS: del equipo, sí, pero no de esta emergencia.
    return NextResponse.json({ error: "forbidden", detail: error?.message }, { status: 403 });
  }

  const url = absoluteUrl(`/invitacion?t=${encodeURIComponent(data.token)}`);

  if (email) {
    // `after()` por lo mismo que en el resto: una instancia congelada al responder mata
    // el envío SMTP en vuelo.
    after(() => sendCenterInvite({ to: email, place: place.name as string, inviteUrl: url }));
  }

  // El enlace vuelve SIEMPRE, con correo o sin él: es lo que se copia y se manda por
  // WhatsApp, que es como se coordina de verdad.
  return NextResponse.json({ ok: true, url, emailed: Boolean(email) });
}
