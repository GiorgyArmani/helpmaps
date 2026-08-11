"use client";

import { useEffect, useState } from "react";
import { FEATURES, SEISMIC, storageKey } from "@/config";
import type { IntensityContour, Quake } from "@/domain/hazard";
import { principalQuake } from "@/domain/hazard";
import { fetchIntensityContours, fetchQuakes } from "@/features/hazard/usgs";

const CACHE_KEY = storageKey("quakes:v1");

interface Cached {
  at: number;
  quakes: Quake[];
  contours: IntensityContour[];
  /** Which event the cached contours belong to. */
  contourFor: string | null;
}

export interface QuakeState {
  quakes: Quake[];
  /** MMI contours of the principal event — the affected zone. */
  contours: IntensityContour[];
  principal: Quake | null;
  loading: boolean;
  /** Painting a previous session's data because USGS did not answer. */
  stale: boolean;
}

const EMPTY: QuakeState = {
  quakes: [],
  contours: [],
  principal: null,
  loading: false,
  stale: false,
};

/**
 * The seismic picture, cache-first for the same reason the shelter list is: this is used
 * on a connection that drops, and a two-hour-old intensity map still answers "did the
 * shaking reach my municipio" correctly. Shaking that already happened does not expire.
 *
 * Only the PRINCIPAL event's contours are fetched. Every aftershock having its own
 * overlapping footprint would be ~100 KB each for a picture nobody can read; the question
 * the layer exists to answer is about the main shock.
 */
export function useQuakes(): QuakeState {
  const [state, setState] = useState<QuakeState>(() =>
    SEISMIC.enabled ? { ...EMPTY, loading: true } : EMPTY,
  );

  // Hydrate from the last successful load. In an effect, not a lazy initialiser:
  // localStorage does not exist during the server render, and seeding from it would make
  // the hydration markup disagree with the HTML.
  useEffect(() => {
    if (!SEISMIC.enabled || !FEATURES.offline) return;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Cached;
      if (!Array.isArray(parsed.quakes) || parsed.quakes.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external store, see above
      setState((s) => ({
        ...s,
        quakes: parsed.quakes,
        contours: Array.isArray(parsed.contours) ? parsed.contours : [],
        principal: principalQuake(parsed.quakes),
      }));
    } catch {
      /* a corrupt cache is not worth a crash; the fetch below replaces it */
    }
  }, []);

  useEffect(() => {
    if (!SEISMIC.enabled) return;
    const ac = new AbortController();
    let timer: number | undefined;

    async function load() {
      try {
        const quakes = await fetchQuakes(ac.signal);
        if (ac.signal.aborted) return;
        const principal = principalQuake(quakes);

        setState({ quakes, contours: [], principal, loading: false, stale: false });

        // The contours are a second, much larger round trip. The epicentres paint first
        // so the map is useful while the footprint is still coming down the wire.
        let contours: IntensityContour[] = [];
        if (principal && principal.hasShakemap && principal.magnitude >= SEISMIC.contourMinMagnitude) {
          try {
            contours = await fetchIntensityContours(principal, ac.signal);
          } catch {
            /* no footprint is survivable; the epicentres still say where it broke */
          }
          if (ac.signal.aborted) return;
          if (contours.length > 0) setState((s) => ({ ...s, contours }));
        }

        if (!FEATURES.offline) return;
        try {
          const payload: Cached = {
            at: Date.now(),
            quakes,
            contours,
            contourFor: principal?.id ?? null,
          };
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch {
          /* quota exceeded: we lose offline seismic data, nothing else */
        }
      } catch {
        if (ac.signal.aborted) return;
        // Keep whatever the cache painted and flag it rather than blanking the layer.
        setState((s) => ({ ...s, loading: false, stale: s.quakes.length > 0 }));
      }
    }

    void load();

    if (SEISMIC.refreshMinutes > 0) {
      timer = window.setInterval(() => void load(), SEISMIC.refreshMinutes * 60_000);
    }

    return () => {
      ac.abort();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, []);

  return state;
}
