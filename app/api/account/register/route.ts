import { NextResponse, after } from "next/server";
import { absoluteUrl } from "@/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { isEmail } from "@/lib/sanitize";
import { MIN_PASSWORD_PUBLIC, publicPasswordTooShort } from "@/lib/password";
import { isPwnedPassword } from "@/lib/passwordBreach";
import { cleanDisplayName, displayNameInvalid } from "@/domain/account";
import { sendAccountConfirm } from "@/lib/email";
import { isKnownRegion } from "@/config";

/**
 * Crear una cuenta de persona. Pública, sin invitación.
 *
 * ── POR QUÉ ESTO ES UNA RUTA NUESTRA Y NO `supabase.auth.signUp()` ──────────
 *
 * El registro directo desde el navegador funcionaría en tres líneas, y trae tres cosas
 * que no queremos:
 *
 *   1. El correo de confirmación lo manda el mailer de Supabase, con su plantilla y su
 *      dominio. Todo el resto del producto sale por el SMTP del despliegue, en el idioma
 *      y la marca del país. Ya vimos a dónde lleva mezclar los dos caminos: una
 *      invitación del panel de Supabase aterriza en el mapa en vez de en `/reset`.
 *
 *   2. Obliga a dejar `disable_signup: false` en el proyecto, que es un registro abierto
 *      contra la API de auth sin límite de tasa nuestro, sin comprobación de contraseña
 *      filtrada y sin nada que podamos moderar. Con esta ruta, ese interruptor se APAGA
 *      en Supabase y la única puerta es ésta.
 *
 *   3. `signUp` distingue con su respuesta una cuenta que ya existe de una nueva, y eso
 *      convierte el registro en un oráculo de direcciones: probá mil correos y sabés
 *      cuáles tienen cuenta. Acá la respuesta es siempre la misma.
 *
 * ── LO QUE PROTEGE DE QUE ESTO SEA UN ENVIADOR DE CORREO ABIERTO ────────────
 *
 * Esta ruta manda correo a direcciones que teclea cualquiera. La plantilla está escrita
 * para que ese correo sea inofensivo aunque se dispare contra la dirección de otro (no
 * interpola NADA del formulario — ver la nota en `src/lib/email.ts`), pero eso resuelve
 * el contenido, no el volumen. El volumen lo resuelve el límite por IP de acá abajo, y
 * bajarlo o quitarlo convierte esto en un relé de spam con nuestro dominio en el `From`.
 */

/** Cuántas cuentas puede intentar crear una misma IP por ventana. */
const MAX_PER_IP = 3;

/** Lo que dice el enlace del correo, y lo que Supabase realmente aplica. */
const CONFIRM_HOURS = 24;

export async function POST(req: Request) {
  const limit = rateLimit(`register:${clientIp(req.headers)}`, MAX_PER_IP);
  if (!limit.ok) return tooManyRequests(limit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const displayName = cleanDisplayName(raw.displayName);
  const region =
    typeof raw.region === "string" && isKnownRegion(raw.region) ? raw.region : null;

  if (!isEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (displayNameInvalid(displayName)) {
    return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
  }
  // El mínimo de PERSONA (8), no el del equipo (12): esta cuenta no publica nada. Al
  // ascender a alguien a voluntario sí se le exige el del equipo, y para eso ya está el
  // enlace a `/reset` que manda la aprobación. Ver `src/lib/password.ts`.
  if (publicPasswordTooShort(password)) {
    return NextResponse.json(
      { error: "password_too_short", min: MIN_PASSWORD_PUBLIC },
      { status: 400 },
    );
  }
  if (await isPwnedPassword(password)) {
    return NextResponse.json({ error: "pwned_password" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // A partir de acá la respuesta es SIEMPRE la misma, pase lo que pase. Ver el punto 3 de
  // la nota de arriba: una respuesta distinta para "ya existe" convierte esto en un
  // buscador de direcciones registradas.
  const ok = NextResponse.json({ ok: true });

  // `generateLink` con `type: "signup"` crea la cuenta SIN confirmar y devuelve el enlace
  // que la confirma — sin que el mailer de Supabase mande nada. Es el mismo mecanismo con
  // el que el panel provisiona voluntarios, y por eso el correo sale por nuestro SMTP.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo: absoluteUrl("/cuenta"),
      data: { display_name: displayName, region },
    },
  });

  if (error || !data?.user) {
    // Lo más común acá es "ya existe una cuenta con ese correo", que no es un fallo y no
    // se cuenta como uno. Se registra para poder distinguir eso de un SMTP caído, pero
    // quien llama recibe el mismo `ok` de siempre.
    console.warn("[register] generateLink:", error?.message ?? "sin usuario");
    return ok;
  }

  // El perfil se crea acá y no con un trigger sobre `auth.users`: un trigger en el
  // esquema `auth` es invisible desde este repo —no está en ninguna migración que alguien
  // pueda leer— y se pierde en la próxima base que se levante desde `db/`.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { user_id: data.user.id, display_name: displayName, region },
      { onConflict: "user_id" },
    );
  if (profileError) {
    console.error("[register] no se pudo crear el perfil:", profileError.message);
  }

  const confirmUrl = data.properties?.action_link;
  if (confirmUrl) {
    // `after()` y no una promesa suelta: una instancia serverless congelada al responder
    // mata un envío SMTP en vuelo. Mismo patrón que /api/suggest.
    after(() => sendAccountConfirm({ to: email, confirmUrl, hours: CONFIRM_HOURS }));
  }

  return ok;
}
