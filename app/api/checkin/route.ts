import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { distanceKm } from "@/domain/center";

/**
 * «Estoy aquí»: la visita a un punto, comprobada y anotada.
 *
 *   POST { locationId, lat, lng }  →  { ok, xp } | { error: "too_far", km }
 *
 * ── LA REGLA, Y ES LA RAZÓN DE QUE ESTA RUTA EXISTA ────────────────────────
 *
 * LA UBICACIÓN NO SE GUARDA. Llega, se usa para una resta, y se va con la petición.
 *
 * No se escribe en ninguna tabla, no se registra en ningún log —de ahí que no haya un
 * solo `console.log` con `lat` o `lng` en este archivo, y no puede haberlo nunca—, y no
 * viaja a ningún tercero. Lo único que sobrevive es una fila en `contributions` que dice
 * «hizo check-in en este punto», y esa tabla sólo la lee su dueño: ni el equipo, ni un
 * superadmin. Ver el encabezado de `db/06_reconocimiento.sql`.
 *
 * Transmitir para comprobar no es lo mismo que guardar, y la diferencia es todo el
 * diseño. Sin transmitirla no hay forma automática de saber que alguien estuvo allí;
 * guardándola tendríamos el historial de movimientos de cada voluntario del país.
 *
 * ── POR QUÉ LA PRUEBA ES LA DISTANCIA Y NO EL CÓDIGO QR ────────────────────
 *
 * Un QR impreso en un cartel se fotografía y circula por WhatsApp en una tarde: como
 * prueba de presencia no vale nada. Así que el QR de un punto no es una llave, es un
 * atajo — abre esta pantalla ya apuntando al punto correcto. Lo que decide es estar
 * cerca.
 *
 * De ahí sale una ventaja que no es menor: el check-in funciona en los cientos de puntos
 * que NO tienen cartel impreso, que son todos los de hoy.
 *
 * ── LO QUE ESTO NO PUEDE EVITAR ────────────────────────────────────────────
 *
 * Un teléfono puede falsear su GPS. Esto detiene a quien reclama visitas desde el sofá,
 * no a quien se instala una aplicación para mentirle a su posición. Es la barrera
 * proporcionada a lo que hay en juego, y conviene saber dónde está puesta antes de que un
 * beneficio dependa de ella.
 */

/** Cuánto se acepta como «estar allí». */
const RADIO_KM = 0.15;

/** Peticiones por IP y minuto. Un check-in es un gesto humano, no una ráfaga. */
const MAX_PER_IP = 10;

export async function POST(req: Request) {
  const limit = rateLimit(`checkin:${clientIp(req.headers)}`, MAX_PER_IP);
  if (!limit.ok) return tooManyRequests(limit);

  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const locationId = typeof raw.locationId === "string" ? raw.locationId.trim() : "";
  const lat = typeof raw.lat === "number" ? raw.lat : NaN;
  const lng = typeof raw.lng === "number" ? raw.lng : NaN;

  if (!locationId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // El punto, leído con la sesión de quien llama: si no puede verlo, no puede fichar en él.
  const { data: punto } = await sb
    .from("locations")
    .select("lat,lng,active")
    .eq("id", locationId)
    .maybeSingle();

  if (!punto || punto.active === false || punto.lat === null || punto.lng === null) {
    // Una iniciativa `digital` no tiene coordenadas, y ahí no se ficha: no hay un sitio
    // al que ir. Cae aquí y responde lo mismo que un punto inexistente.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const km = distanceKm(
    { lat, lng },
    { lat: punto.lat as number, lng: punto.lng as number },
  );

  // A partir de esta línea, `lat` y `lng` ya no se usan para nada. No se registran, no se
  // pasan a la base y no salen de esta función.
  if (km > RADIO_KM) {
    // Se devuelve la distancia REDONDEADA para que la pantalla pueda decir «estás a 2 km»
    // en vez de un «no» sin explicación. Redondeada porque el número exacto es la
    // ubicación otra vez, contada al revés.
    return NextResponse.json(
      { error: "too_far", km: Math.round(km * 10) / 10 },
      { status: 422 },
    );
  }

  // El service role es lo que hace que esto valga: `record_contribution` ya no se puede
  // llamar desde el navegador, precisamente para que un check-in de 10 puntos no se pueda
  // reclamar sin pasar por esta comprobación.
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: total, error } = await admin.rpc("record_contribution", {
    p_kind: "checkin",
    p_location_id: locationId,
    p_user_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  // `xp` es el total NUEVO. Repetir el check-in del mismo punto el mismo día devuelve el
  // mismo número que ya tenía, y la pantalla lo cuenta como «ya fichaste aquí hoy».
  return NextResponse.json({ ok: true, xp: Number(total) || 0 });
}
