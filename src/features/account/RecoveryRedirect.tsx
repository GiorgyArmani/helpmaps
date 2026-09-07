"use client";

import { useEffect } from "react";

/**
 * Rescata un enlace de recuperación que aterrizó en el sitio equivocado.
 *
 * ── EL PROBLEMA, Y ES DE CONFIGURACIÓN, NO DE CÓDIGO ────────────────────────
 *
 * Los enlaces de «elige tu contraseña» se acuñan con `generateLink` pidiendo
 * `redirectTo: /reset`. Supabase sólo respeta ese destino si la URL está en la lista de
 * *Redirect URLs* del proyecto (Authentication → URL Configuration); si no está, la
 * DESCARTA EN SILENCIO y manda al *Site URL*, o sea a la raíz.
 *
 * Comprobado contra este proyecto el 2026-09-07: pidiendo `/reset` —tanto en el dominio
 * de producción como en localhost— el enlace devuelto redirige a la raíz. Es decir, quien
 * abre el correo aterriza en el mapa, con una sesión de recuperación en la mano y sin
 * ninguna pantalla donde gastarla. El comentario de `app/reset/page.tsx` ya describía
 * exactamente este síntoma para las invitaciones.
 *
 * ── POR QUÉ ESTO EXISTE IGUAL ───────────────────────────────────────────────
 *
 * El arreglo de verdad es añadir esas URLs en el panel de Supabase, y hay que hacerlo.
 * Pero es un ajuste en un servicio externo que este repositorio no puede garantizar: una
 * clonación nueva en otro país empieza con la lista vacía, y el primero en descubrirlo
 * sería alguien que no puede volver a entrar a su cuenta.
 *
 * Así que el token no se pierde: llegue donde llegue, esto lo lleva a `/reset` con el
 * fragmento intacto. Con la configuración correcta nunca se dispara.
 *
 * ── POR QUÉ MIRA EL FRAGMENTO Y NO PREGUNTA A SUPABASE ──────────────────────
 *
 * El `#access_token=…&type=recovery` viaja en el FRAGMENTO, que el navegador no manda al
 * servidor: sólo se puede leer aquí. Y se lee antes de que nadie cree un cliente de
 * Supabase, porque ese cliente lo consume al construirse (`detectSessionInUrl`) y lo
 * borra de la barra de direcciones. De ahí que este componente no importe nada de
 * `@/lib/supabase` — leer el hash es todo lo que necesita, y hacerlo primero es la
 * condición para que funcione.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("type=recovery")) return;
    // Ya estamos donde hay que estar: la página se encarga.
    if (window.location.pathname.startsWith("/reset")) return;

    // `replace` y no `push`: el enlace del correo no debería quedar en el historial,
    // porque volver atrás llevaría a una URL con un token que ya se gastó.
    window.location.replace(`/reset${hash}`);
  }, []);

  return null;
}
