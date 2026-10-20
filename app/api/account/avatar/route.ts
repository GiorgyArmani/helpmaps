import { NextResponse } from "next/server";
import { COUNTRY } from "@/config";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encodeAvatar, faunaOf, parseAvatar } from "@/domain/avatar";
import { levelFor } from "@/domain/badges";

/**
 * Guardar TU avatar.   POST { avatar }  →  { ok, avatar, code }
 *
 * ── EL NIVEL LO CALCULA ESTA RUTA, NO EL NAVEGADOR ──────────────────────────
 *
 * Los especiales (chaleco, brazalete, marco…) se ganan con el nivel, y el nivel sale de
 * sumar `contributions`, una tabla que nadie puede escribir desde el navegador. Se suma acá
 * con la sesión de quien llama —la política le deja leer sólo lo suyo—, así que lo que
 * mande el cliente sobre su nivel no cuenta: una pieza que pide más de lo que tiene se cae
 * en `parseAvatar` sin más.
 *
 * ── POR QUÉ ESCRIBE CON EL ROL DE SERVICIO ──────────────────────────────────
 *
 * `db/18_avatar.sql` pone un trigger que rechaza cualquier cambio de `profiles.avatar` que
 * no venga con ese rol. Sin él, la política de `profiles` dejaría a cada uno escribirse el
 * chaleco directo por la API y esta comprobación sería decorativa. El id al que se escribe
 * es el de la sesión: esta ruta no recibe ningún id y no puede apuntar a otra persona.
 *
 * ── LA COPIA EN LA SESIÓN ───────────────────────────────────────────────────
 *
 * Además se guarda un código corto en los metadatos del usuario, que es lo que la barra
 * lee del token sin salir a la red. El navegador refresca su sesión al recibir el `ok`.
 * Si la base todavía no tiene la columna, el avatar queda sólo ahí y la cuenta funciona.
 */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = ((await req.json()) as { avatar?: unknown } | null)?.avatar;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // La experiencia real: la suma de lo que la base le reconoce. Sin la tabla, nivel 1.
  const { data: rows } = await sb.from("contributions").select("points");
  const xp = (rows ?? []).reduce((n, r) => n + (Number((r as { points: unknown }).points) || 0), 0);
  const level = levelFor(xp).level;

  const avatar = parseAvatar(raw, { species: faunaOf(COUNTRY), level });
  if (!avatar) return NextResponse.json({ error: "invalid_avatar" }, { status: 422 });
  // El marco de araguaney no se elige: es de quien llegó al último nivel, y de nadie más.
  if (level >= 5) avatar.marco = { id: "araguaney" };
  else delete avatar.marco;
  const code = encodeAvatar(avatar);

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { error: dbError } = await admin.from("profiles").update({ avatar }).eq("user_id", user.id);
  const sinColumna = dbError?.code === "42703" || dbError?.code === "PGRST204";
  if (dbError && !sinColumna) {
    console.error("[avatar] no se pudo guardar:", dbError.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  const { error: metaError } = await sb.auth.updateUser({ data: { avatar: code } });
  if (metaError) {
    // El perfil ya lo tiene; la barra seguirá con el anterior hasta la próxima sesión.
    console.warn("[avatar] metadatos:", metaError.message);
    if (sinColumna) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatar, code });
}
