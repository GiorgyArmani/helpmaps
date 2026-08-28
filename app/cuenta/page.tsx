"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/context";
import { getSupabase } from "@/lib/supabase/client";
import { Spinner } from "@/ui/primitives";

/**
 * `/cuenta` — ya no es una página, es un aterrizaje.
 *
 * ── QUÉ CAMBIÓ, Y POR QUÉ ───────────────────────────────────────────────────
 *
 * Esto era una página entera, fuera de la aplicación, con su propio encabezado y su propio
 * enlace de vuelta al mapa. Abrir tu cuenta te sacaba del producto: perdías el mapa, los
 * filtros y el punto que estabas mirando, para leer una lista de tres cosas y volver.
 *
 * La cuenta vive ahora DENTRO de la aplicación, en la misma capa que el resto de paneles
 * (`AccountView`), y se abre desde el avatar de la barra. Lo único que sigue necesitando
 * una ruta propia es esto: `/api/account/register` acuña el enlace de confirmación con
 * `redirectTo` apuntando acá, y ese contrato ya está en correos enviados. Cambiarlo
 * rompería la confirmación de todo el que se registró ayer.
 *
 * Así que esta ruta hace lo mínimo y se aparta: canjea el código y manda al mapa con la
 * cuenta abierta.
 *
 * ── LA SESIÓN SE RESUELVE ACÁ, NO EN EL MAPA ────────────────────────────────
 *
 * Supabase entrega `?code=` (PKCE) o `#access_token=` (implícito) según cómo esté
 * configurado el proyecto, y cuál te toca no lo decide esta página. El canje tiene que
 * ocurrir antes de irse: si se redirige primero, el fragmento se pierde en el camino y la
 * persona llega al mapa sin sesión — el mismo callejón sin salida que ya nos comimos con
 * las invitaciones del panel de Supabase.
 */
export default function AccountLanding() {
  const { t } = useI18n();

  useEffect(() => {
    const sb = getSupabase();

    void (async () => {
      // El código es de un solo uso; que falle no cambia el destino, sólo significa que
      // se llega sin sesión y la cuenta muestra el formulario de acceso.
      const code = new URLSearchParams(window.location.search).get("code");
      if (sb && code) await sb.auth.exchangeCodeForSession(code).catch(() => null);

      // `replace` y no `push`: volver atrás desde el mapa no debe devolver a un enlace de
      // confirmación ya gastado.
      window.location.replace("/?a=account");
    })();
  }, []);

  return (
    <main className="loginwrap">
      <Spinner />
      <p className="small mut">{t("account.checking")}</p>
    </main>
  );
}
