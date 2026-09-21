"use client";

import { useEffect } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { readPendingInvite } from "./pendingInvite";

/**
 * Devuelve a la invitación a quien la dejó a medias para crear su cuenta.
 *
 * Es la red de seguridad de `pendingInvite.ts`: la confirmación del registro aterriza en
 * el mapa (Supabase descarta el `redirectTo`), y sin esto la persona se quedaba en el
 * flujo de un usuario cualquiera, sin rastro del punto que la invitaron a gestionar.
 *
 * Sólo actúa con sesión: sin ella, `/invitacion` sólo volvería a pedir la cuenta.
 */
export default function PendingInviteRedirect() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/invitacion") || path.startsWith("/reset")) return;
    // Un enlace de recuperación es de `RecoveryRedirect`, y crear el cliente aquí se
    // comería el fragmento antes de que llegue a `/reset`.
    if (window.location.hash.includes("type=recovery")) return;
    const token = readPendingInvite();
    if (!token) return;

    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    void sb.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      window.location.replace(`/invitacion?t=${encodeURIComponent(token)}`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
