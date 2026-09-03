"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppSettings, Center } from "@/domain/types";
import { fetchCenters } from "@/data/centers";
import { fetchSettings } from "@/data/staff";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

import { useEmergencyId, useSite, useSiteHelpers } from "@/features/app/SiteProvider";

interface Cached {
  at: number;
  centers: Center[];
  settings: AppSettings;
}

export interface CentersState {
  centers: Center[];
  settings: AppSettings;
  loading: boolean;
  /** Showing data from a previous session because the network did not answer. */
  stale: boolean;
  /** When that cached data was written. */
  cachedAt: number | null;
  error: string | null;
  configured: boolean;
  reload: () => void;
}

/**
 * Cache-first load.
 *
 * The connection this app is designed for drops mid-request. So: paint whatever the last
 * successful load left in localStorage immediately, then revalidate in the background. If
 * the revalidation fails we KEEP showing the cached points and say so — an out-of-date
 * shelter list still gets someone to a door, while an empty screen gets them nothing.
 */
export function useCenters(): CentersState {
  const emergencyId = useEmergencyId();
  const helpers = useSiteHelpers();
  // Namespaced by the RESOLVED slug, not the compiled one: two emergencies opened in the
  // same browser must not read each other's cached points, and the cache outlives the tab.
  // v2: rows gained `coverage_regions`/`coverage_municipalities`. A v1 cache would hand
  // the filter a Center without those arrays and crash the first region filter.
  const cacheKey = helpers.storageKey("centers:v2");
  // El modo sin señal lo decide la EMERGENCIA, no el preset: un país puede apagarlo.
  const offline = useSite().features.offline;

  const [centers, setCenters] = useState<Center[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ maintenance: false, notice: null });
  // Starts false when there is nothing to load, so the effect below never has to
  // synchronously correct it on mount.
  const [loading, setLoading] = useState(() => supabaseConfigured());
  const [stale, setStale] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const configured = supabaseConfigured();

  // 1. Hydrate from cache.
  //
  // This runs in an effect rather than in a lazy initialiser on purpose: localStorage
  // does not exist while the page is rendered on the server, so seeding state from it
  // during the first render would make the server and client markup disagree.
  useEffect(() => {
    if (!offline) return;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Cached;
      if (Array.isArray(parsed.centers) && parsed.centers.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- external store, see above
        setCenters(parsed.centers);
        setSettings(parsed.settings ?? { maintenance: false, notice: null });
        setCachedAt(parsed.at ?? null);
      }
    } catch {
      // A corrupt cache is not worth a crash; the network load below replaces it.
    }
  }, [cacheKey]);

  // 2. Revalidate.
  useEffect(() => {
    let cancelled = false;
    const sb = getSupabase();
    if (!sb) return;

    (async () => {
      try {
        const [fresh, appSettings] = await Promise.all([
          fetchCenters(sb, emergencyId),
          fetchSettings(sb),
        ]);
        if (cancelled) return;
        setCenters(fresh);
        setSettings(appSettings);
        setStale(false);
        setError(null);
        setCachedAt(Date.now());
        if (!offline) return;
        try {
          const payload: Cached = { at: Date.now(), centers: fresh, settings: appSettings };
          window.localStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch {
          // Quota exceeded on a very full phone: not fatal, we just lose offline mode.
        }
      } catch (err) {
        if (cancelled) return;
        // Keep whatever the cache gave us and flag it, rather than blanking the map.
        setStale(true);
        setError(err instanceof Error ? err.message : "load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick, emergencyId, cacheKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setTick((n) => n + 1);
  }, []);

  return { centers, settings, loading, stale, cachedAt, error, configured, reload };
}
