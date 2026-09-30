import { NextResponse, after } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { cleanPhone, cleanText } from "@/lib/sanitize";
import { notifyManageRequest } from "@/lib/email";

/**
 * «¿Es tu organización?» — pedir gestionar un punto que ya está en el mapa.
 *
 *   POST { locationId, role, phone?, proof? }  →  { ok }
 *
 * No concede nada: deja la solicitud pendiente y avisa al equipo. Quién puede pedir, qué
 * y cuántas veces lo decide la base (`db/15_gestion.sql`): la inserción va con la sesión
 * de quien llama, así que la política exige que sea a su nombre y que no gestione ya ese
 * punto, y el índice único para una segunda solicitud viva.
 *
 * Pasa por aquí y no directo desde el navegador sólo por el aviso: el correo al equipo
 * necesita el SMTP del servidor, y una solicitud que nadie ve es una organización que se
 * cansa de esperar justo en la campaña que la fue a buscar.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`manage:${clientIp(req.headers)}`, 5);
  if (!limit.ok) return tooManyRequests(limit);

  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const locationId = typeof raw.locationId === "string" ? raw.locationId.trim() : "";
  const role = cleanText(raw.role, 120);
  const phone = cleanPhone(raw.phone, 40) || null;
  const proof = cleanText(raw.proof, 600) || null;
  if (!locationId || role.length < 2) {
    return NextResponse.json({ error: "invalid_input" }, { status: 422 });
  }

  // El nombre lo lee el servidor: el correo al equipo lo lleva dentro.
  const { data: place } = await sb
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .maybeSingle();
  if (!place) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await sb
    .from("manage_requests")
    .insert({ location_id: locationId, user_id: user.id, role, phone, proof });

  if (error) {
    // Dos toques seguidos, o volver a pedir lo que ya está en revisión: es la misma
    // respuesta que «ya la tenemos», no un fallo.
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_pending" }, { status: 409 });
    }
    // RLS: ya gestiona ese punto.
    if (error.code === "42501") {
      return NextResponse.json({ error: "already_manager" }, { status: 409 });
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 502 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // Al buzón del EQUIPO, nunca a la dirección de quien pide. `after()`: una instancia
  // congelada al responder mata el envío SMTP en vuelo.
  after(() =>
    notifyManageRequest({
      place: String(place.name ?? locationId),
      name: (profile?.display_name as string | null) ?? null,
      email: user.email ?? "",
      role,
      phone,
      proof,
    }),
  );

  return NextResponse.json({ ok: true });
}
