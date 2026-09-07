import { NextResponse, after } from "next/server";
import { absoluteUrl } from "@/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";
import { isEmail } from "@/lib/sanitize";
import { sendPasswordReset } from "@/lib/email";

/**
 * Pedir un enlace para elegir una contraseña nueva.
 *
 *   POST { email }
 *
 * ── LO QUE FALTABA ─────────────────────────────────────────────────────────
 *
 * `/reset` —donde ATERRIZA el enlace— existía desde el principio, porque es a donde
 * manda la aprobación de un voluntario. Lo que no existía era la forma de PEDIRLO: quien
 * olvidaba su contraseña no tenía ninguna salida, y la única manera de volver a entrar
 * era escribirle al equipo para que le acuñara un enlace a mano.
 *
 * ── POR QUÉ ES UNA RUTA NUESTRA Y NO `resetPasswordForEmail()` ─────────────
 *
 * Las mismas tres razones que en `/api/account/register`, y valen igual aquí:
 *
 *   1. El correo saldría por el mailer de Supabase, con su plantilla y su dominio. Todo
 *      el resto del producto sale por el SMTP del despliegue, con la marca del país.
 *   2. `generateLink` deja el envío en nuestras manos, así que este correo pasa por el
 *      mismo `deliver()` y la misma plantilla que los demás.
 *   3. La respuesta puede ser siempre idéntica. `resetPasswordForEmail` también lo es,
 *      pero llamándolo desde el navegador el límite de tasa es el de Supabase y no el
 *      nuestro.
 *
 * ── LA RESPUESTA ES SIEMPRE LA MISMA ───────────────────────────────────────
 *
 * Exista la cuenta o no, esté confirmada o no, falle el SMTP o no: `{ ok: true }`. Una
 * respuesta distinta para «esa dirección no tiene cuenta» convierte esto en un buscador
 * de direcciones registradas en un mapa de emergencia, y esa lista no es inofensiva.
 * Misma regla que el registro.
 *
 * ── LOS DOS LÍMITES, Y POR QUÉ SON DOS ─────────────────────────────────────
 *
 * Por IP, para que nadie use esto como relé de correo. Y por DIRECCIÓN, que es el que
 * no hace falta en el registro: aquí el destinatario puede ser alguien que no pidió
 * nada, y sin ese segundo límite bastan unas cuantas IPs para llenarle el buzón a una
 * persona concreta. La ventana es más larga que la del registro por lo mismo.
 */

/** Peticiones por IP y ventana. */
const MAX_PER_IP = 5;

/** Peticiones por DIRECCIÓN y ventana. Bajo a propósito: nadie pide esto cinco veces. */
const MAX_PER_EMAIL = 3;

/** Quince minutos, en vez del minuto por defecto. */
const WINDOW_MS = 15 * 60_000;

/**
 * Lo que dice el correo. Supabase caduca los enlaces de recuperación en una hora por
 * defecto; si este número y aquel ajuste dejan de coincidir, el correo miente.
 */
const RESET_HOURS = 1;

export async function POST(req: Request) {
  const byIp = rateLimit(`reset:ip:${clientIp(req.headers)}`, MAX_PER_IP, WINDOW_MS);
  if (!byIp.ok) return tooManyRequests(byIp);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";

  // El correo mal formado sí se distingue, y no delata nada: no dice si existe, dice que
  // lo escrito no es una dirección. Sin esto, un dedazo se traga en silencio y la persona
  // espera un correo que nunca se intentó mandar.
  if (!isEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const byEmail = rateLimit(`reset:mail:${email}`, MAX_PER_EMAIL, WINDOW_MS);
  if (!byEmail.ok) {
    // También aquí `ok`: decir «has pedido demasiados» para una dirección concreta
    // confirmaría que a alguien le interesa esa dirección. El límite frena el envío, que
    // es su trabajo; no tiene por qué anunciarse.
    return NextResponse.json({ ok: true });
  }

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // A partir de aquí, pase lo que pase.
  const ok = NextResponse.json({ ok: true });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: absoluteUrl("/reset") },
  });

  if (error || !data?.properties?.action_link) {
    // Lo más común es «no existe una cuenta con ese correo», que no es un fallo de nada.
    // Se registra para poder distinguirlo de un Supabase caído; quien llama recibe `ok`.
    console.warn("[reset] generateLink:", error?.message ?? "sin enlace");
    return ok;
  }

  // `after()` y no una promesa suelta: una instancia serverless congelada al responder
  // mata un envío SMTP en vuelo. Mismo patrón que /api/account/register.
  after(() =>
    sendPasswordReset({
      to: email,
      resetUrl: data.properties.action_link,
      hours: RESET_HOURS,
    }),
  );

  return ok;
}
