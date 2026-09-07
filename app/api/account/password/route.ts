import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import {
  MIN_PASSWORD,
  MIN_PASSWORD_PUBLIC,
  passwordTooShort,
  publicPasswordTooShort,
} from "@/lib/password";
import { isPwnedPassword } from "@/lib/passwordBreach";

/**
 * Cambiar TU propia contraseña. Cualquier cuenta, no sólo el equipo.
 *
 *   POST { password }
 *
 * ── POR QUÉ EXISTE, Y QUÉ ESTABA ROTO ──────────────────────────────────────
 *
 * `/reset` —la pantalla donde se elige una contraseña nueva— llamaba a
 * `/api/staff/password`, que empieza con `requireStaff()`. Para una cuenta de persona eso
 * responde 403, así que la recuperación de contraseña FUNCIONABA SÓLO PARA EL EQUIPO:
 * cualquier otra persona llegaba hasta el último paso, pulsaba «Guardar» y recibía un
 * error genérico. Medido el 2026-09-07 con una cuenta recién creada.
 *
 * No se arregla ampliando aquella ruta: su nombre y su puerta dicen «equipo», y una ruta
 * bajo `/api/staff/` que deje pasar a cualquiera es una trampa para el siguiente que la
 * lea. Ésta es la que sirve a todo el mundo, y aquélla pasa a delegar aquí.
 *
 * ── NO RECIBE UN ID DE USUARIO, Y NUNCA LO HARÁ ────────────────────────────
 *
 * La actualización corre por la sesión del PROPIO llamante, atada a su cookie, así que la
 * única cuenta que puede cambiar es la suya. No hay service role en este camino y por
 * tanto no hay forma de apuntarlo a otra persona. Misma regla que tenía la ruta de staff.
 *
 * ── EL MÍNIMO DEPENDE DE QUIÉN ERES ────────────────────────────────────────
 *
 * 12 para el equipo, 8 para una cuenta de persona (ver `src/lib/password.ts`, que explica
 * por qué son dos números y no uno). El rol se mira aquí, en el servidor, y no se acepta
 * del cliente: si lo dijera quien llama, bastaría con mentir para bajarse el listón.
 *
 * La comprobación contra contraseñas filtradas se aplica a las dos por igual — es la que
 * de verdad frena «12345678», que con ocho caracteres pasaría la longitud sin despeinarse.
 */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let password = "";
  try {
    const raw: unknown = await req.json();
    if (raw && typeof raw === "object" && "password" in raw) {
      const value = (raw as { password: unknown }).password;
      password = typeof value === "string" ? value : "";
    }
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // ¿Es del equipo? Decide el listón, y lo decide el servidor.
  const { data: staff } = await sb
    .from("staff_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const isStaff = Boolean(staff?.role);

  const tooShort = isStaff ? passwordTooShort(password) : publicPasswordTooShort(password);
  const min = isStaff ? MIN_PASSWORD : MIN_PASSWORD_PUBLIC;
  if (tooShort) {
    return NextResponse.json({ error: "password_too_short", min }, { status: 422 });
  }
  if (await isPwnedPassword(password)) {
    return NextResponse.json({ error: "pwned_password" }, { status: 422 });
  }

  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 400 });
  }

  // `min` viaja de vuelta para que la pantalla sepa contra qué listón se validó sin tener
  // que adivinar el rol por su cuenta.
  return NextResponse.json({ ok: true, min });
}
