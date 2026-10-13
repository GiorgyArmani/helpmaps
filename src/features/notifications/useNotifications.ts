"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Center } from "@/domain/types";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyFavourites } from "@/data/account";
import { fetchNotificationSources } from "@/data/notifications";
import { buildNotifications, countUnread, type Notif, type NotifSources } from "@/domain/notifications";

/**
 * La bandeja de quien tiene sesión: qué hay, y cuánto de eso es nuevo.
 *
 * ── CUÁNDO SE PIDE ──────────────────────────────────────────────────────────
 *
 * El número sobre el avatar tiene que estar SIN abrir nada —para eso es— así que esto no
 * puede esperar al menú como `useAccount`. Pero tampoco entra en el arranque del mapa: se
 * pide con los puntos ya cargados y un respiro después, y sólo si hay un token en este
 * navegador. Quien entra sin cuenta, que es casi todo el mundo, no paga ni una petición.
 *
 * ── «VISTO» VIVE EN ESTE TELÉFONO ───────────────────────────────────────────
 *
 * La fecha de la última visita se guarda en `localStorage`, por cuenta. No es un dato que
 * merezca una columna: lo peor que pasa al cambiar de teléfono es volver a ver como nuevo
 * lo del último mes. Y no dice dónde está nadie, que es lo único que este proyecto no
 * guarda ahí.
 */

/** El respiro tras cargar el mapa. Lo primero es el mapa. */
const DELAY_MS = 1200;

const seenKey = (uid: string) => `hmNotifSeen:${uid}`;

function readSeen(uid: string): string | null {
  try {
    return window.localStorage.getItem(seenKey(uid));
  } catch {
    return null;
  }
}

export interface NotificationsState {
  /** Recientes primero. Vacío sin sesión y mientras carga. */
  items: Notif[];
  unread: number;
  /** Falso hasta que la primera tanda termina: distingue «nada» de «todavía no». */
  loaded: boolean;
  /** Hasta cuándo se dio por visto. `null`: nunca se abrió la bandeja. */
  seenAt: string | null;
  /** Dar todo por visto, ahora. */
  markSeen: () => void;
  refresh: () => void;
}

interface Loaded {
  uid: string;
  src: NotifSources;
  saved: Set<string>;
  seenAt: string | null;
}

export function useNotifications({
  enabled,
  centers,
  userId,
  favourites,
}: {
  /** El mapa ya cargó. */
  enabled: boolean;
  centers: Center[];
  /** La cuenta, si `useAccount` ya la resolvió: cambia al entrar o salir desde el menú. */
  userId: string | null;
  /** Sus guardados, si ya están en memoria. Guardar un punto vuelve a pedir lo suyo. */
  favourites: ReadonlySet<string>;
}): NotificationsState {
  const [loadedFor, setLoaded] = useState<Loaded | null>(null);
  const [tick, setTick] = useState(0);
  // Los ids, ordenados: el efecto depende de CUÁLES son, no de la identidad del Set.
  const favKey = useMemo(() => [...favourites].sort().join(","), [favourites]);

  useEffect(() => {
    if (!enabled) return;
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;

    const timer = window.setTimeout(() => {
      void (async () => {
        // `getSession` lee el token del navegador: no cuesta un viaje (ver `useSessionPeek`).
        const { data } = await sb.auth.getSession();
        const uid = data.session?.user.id ?? null;
        if (!vivo) return;
        if (!uid) {
          setLoaded(null);
          return;
        }
        // Los guardados de la cuenta ya abierta, o los propios si el menú no se abrió.
        const ids = userId === uid ? (favKey ? favKey.split(",") : []) : await fetchMyFavourites(sb);
        const src = await fetchNotificationSources(sb, ids);
        if (!vivo) return;
        setLoaded({ uid, src, saved: new Set(ids), seenAt: readSeen(uid) });
      })();
    }, DELAY_MS);

    return () => {
      vivo = false;
      window.clearTimeout(timer);
    };
  }, [enabled, userId, favKey, tick]);

  const items = useMemo(
    () => (loadedFor ? buildNotifications(loadedFor.src, centers, loadedFor.saved) : []),
    [loadedFor, centers],
  );
  const seenAt = loadedFor?.seenAt ?? null;
  const unread = useMemo(() => countUnread(items, seenAt), [items, seenAt]);

  const uid = loadedFor?.uid ?? null;
  const markSeen = useCallback(() => {
    if (!uid) return;
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(seenKey(uid), now);
    } catch {
      /* modo privado: se da por visto hasta recargar */
    }
    setLoaded((cur) => (cur && cur.uid === uid ? { ...cur, seenAt: now } : cur));
  }, [uid]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return { items, unread, loaded: loadedFor !== null, seenAt, markSeen, refresh };
}
