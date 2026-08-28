"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { fetchMyFavourites, fetchMyProfile } from "@/data/account";
import type { Profile } from "@/domain/account";

/**
 * ¿Hay alguien con sesión, y quién es?
 *
 * ── POR QUÉ NO ALCANZA CON `useStaffSession` ────────────────────────────────
 *
 * `useStaffSession` responde "¿es del equipo?", y devuelve `null` tanto para quien no ha
 * entrado como para quien entró y no es del equipo. Mientras el único motivo para tener
 * cuenta era publicar en el mapa, colapsar los dos casos daba igual.
 *
 * Deja de dar igual en cuanto existen cuentas de persona: alguien que acaba de crear la
 * suya, confirmarla y entrar toca el candado y le sale otra vez el formulario de acceso,
 * como si no hubiera pasado nada. Ese es exactamente el callejón sin salida que ya nos
 * comimos dos veces — con las invitaciones del panel de Supabase y con los superadmins sin
 * fila en `staff_users`.
 *
 * Así que este hook responde la otra pregunta, la de más abajo: "¿hay sesión?". Quien
 * quiera saber si además es del equipo sigue preguntándoselo a `useStaffSession`.
 *
 * ── SE RESUELVE PEREZOSAMENTE, IGUAL QUE EL DEL EQUIPO ──────────────────────
 *
 * `active` es falso para todo visitante público. Una consulta de sesión en el camino
 * crítico del mapa gasta un viaje de ida y vuelta, sobre la barra de señal para la que
 * está pensada esta aplicación, respondiendo algo que casi nadie preguntó.
 */
export interface AccountState {
  /** El id de auth de quien tiene la sesión, o null. */
  userId: string | null;
  /** Su perfil. Puede ser null con sesión abierta: las cuentas del equipo creadas antes
   *  de `db/01_esquema.sql § 010_accounts` no tienen fila en `profiles`. */
  profile: Profile | null;
  /** Los puntos que guardó. Vacío mientras no se haya resuelto. */
  favourites: Set<string>;
  /** Falso hasta que la primera consulta termina; distingue "no" de "todavía no". */
  checked: boolean;
  refresh: () => void;
  /** Marca o desmarca en local, para que el botón responda sin esperar al servidor. */
  setFavourite: (locationId: string, on: boolean) => void;
}

export function useAccount(active: boolean): AccountState {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favourites, setFavourites] = useState<Set<string>>(() => new Set());
  const [checked, setChecked] = useState(() => !supabaseConfigured());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;

    void (async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      if (!user) {
        setUserId(null);
        setProfile(null);
        setFavourites(new Set());
        setChecked(true);
        return;
      }
      const [p, favs] = await Promise.all([fetchMyProfile(sb), fetchMyFavourites(sb)]);
      if (cancelled) return;
      setUserId(user.id);
      setProfile(p);
      setFavourites(new Set(favs));
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const setFavourite = useCallback((locationId: string, on: boolean) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (on) next.add(locationId);
      else next.delete(locationId);
      return next;
    });
  }, []);

  return { userId, profile, favourites, checked, refresh, setFavourite };
}
