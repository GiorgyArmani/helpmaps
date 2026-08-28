"use client";

import { useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export interface SessionPeek {
  /** `null` mientras no se ha resuelto; distingue "no hay sesión" de "todavía no sé". */
  hasSession: boolean | null;
  /** La letra que va en el avatar hasta que se conozca el nombre para mostrar. */
  initial: string | null;
}

/**
 * ¿Hay sesión en ESTE navegador? Sin salir a la red.
 *
 * ── POR QUÉ NO ES `useAccount` ──────────────────────────────────────────────
 *
 * `useAccount` llama a `auth.getUser()`, que es un viaje de ida y vuelta al servidor, y
 * `useStaffSession` consulta una tabla. Los dos están detrás de un `active` justamente
 * para no gastar eso en el camino crítico del mapa.
 *
 * Pero el avatar de la barra tiene que saber ya si hay alguien dentro: un botón que
 * empieza diciendo "entrar" y a los dos segundos se convierte en tu inicial es el mismo
 * parpadeo que hace que la gente toque dos veces. `auth.getSession()` lee el token que
 * `@supabase/ssr` guarda en el propio navegador y no pregunta a nadie, así que responde
 * en el mismo tick y no cuesta señal.
 *
 * Lo que devuelve NO es una comprobación de identidad y no debe usarse como una: un token
 * caducado sigue estando en el almacenamiento. Sirve para decidir qué dibujar. Quien
 * necesite saber de verdad quién es alguien —el perfil, el rol— lo pregunta al abrir, que
 * es cuando ya hay un gesto que justifica el viaje.
 *
 * Se queda escuchando `onAuthStateChange` porque entrar y salir ocurre DENTRO de la
 * aplicación, sin navegar: sin esa suscripción el avatar seguiría mostrando la inicial de
 * quien acaba de cerrar sesión hasta la siguiente recarga.
 */
export function useSessionPeek(): SessionPeek {
  const [peek, setPeek] = useState<SessionPeek>(() =>
    supabaseConfigured() ? { hasSession: null, initial: null } : { hasSession: false, initial: null },
  );

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;

    const read = (email: string | undefined, present: boolean) => {
      if (cancelled) return;
      setPeek({
        hasSession: present,
        // Su propia dirección, y sólo su primera letra, y sólo en su propio navegador.
        // Es el mismo dato que ya tiene delante en la pestaña de al lado, y se reemplaza
        // por el nombre para mostrar en cuanto el menú carga el perfil.
        initial: present ? (email?.trim()[0]?.toUpperCase() ?? null) : null,
      });
    };

    void sb.auth.getSession().then(({ data }) => read(data.session?.user.email, Boolean(data.session)));

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      read(session?.user.email, Boolean(session));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return peek;
}

/** La inicial que se pinta en el avatar: la del nombre si ya se conoce, si no la del correo. */
export function avatarInitial(displayName: string | null | undefined, fallback: string | null): string | null {
  const name = displayName?.trim();
  if (name) return [...name][0]!.toUpperCase();
  return fallback;
}
