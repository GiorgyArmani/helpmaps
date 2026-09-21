"use client";

import { useEffect, useRef, useState } from "react";

import { useSite, useSiteHelpers } from "@/features/app/SiteProvider";
import type { IntensityContour, Quake } from "@/domain/hazard";
import { mergeQuakes, principalQuake } from "@/domain/hazard";
import { fetchIntensityContours, fetchQuakes } from "@/features/hazard/usgs";

interface Cached {
  at: number;
  quakes: Quake[];
  contours: IntensityContour[];
  /** Which REVISION of which event the cached contours belong to. See `revision`. */
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
  /** When this catalogue came back, epoch ms. `null` until something has been read. */
  updatedAt: number | null;
}

const EMPTY: QuakeState = {
  quakes: [],
  contours: [],
  principal: null,
  loading: false,
  stale: false,
  updatedAt: null,
};

/**
 * A full catalogue fetch at least this often, however quiet the partial refreshes in
 * between have been. It is what catches the two things `updatedafter` cannot report: an
 * event retired from the catalogue, and one revised down out of `minMagnitude`.
 */
const RESYNC_MS = 60 * 60_000;

/** How old a cached catalogue may be before it is painted as an earlier load. */
const STALE_MS = 30 * 60_000;

/**
 * The identity of a FOOTPRINT: which event, and which revision of it.
 *
 * `id` alone is not enough. USGS recomputes a ShakeMap several times in the first day of a
 * live event, and the contours we hold for `us6000t7zp` at 14:02 are not the ones it
 * publishes at 14:40. `id` alone would never refetch; refetching every poll is 100 KB
 * every quarter of an hour for a picture that did not change.
 */
function revision(quake: Quake | null): string | null {
  return quake ? `${quake.id}:${quake.updated ?? quake.time}` : null;
}

/** The event id inside a revision key, so "revised" can be told from "another event". */
function eventOf(rev: string | null): string | null {
  return rev ? rev.slice(0, rev.lastIndexOf(":")) : null;
}

/**
 * The seismic picture, kept current for as long as the screen is open.
 *
 * Cache-first for the same reason the shelter list is: this is used on a connection that
 * drops, and a two-hour-old intensity map still answers "did the shaking reach my
 * municipio" correctly. Shaking that already happened does not expire.
 *
 * ── LO QUE HACE QUE ESTÉ DE VERDAD AL DÍA ───────────────────────────────────
 *
 * Un `setInterval` no basta, y este bucle existe porque cada una de estas cuatro cosas
 * dejaba la capa vieja sin que nadie lo notara:
 *
 *   1. El teléfono con la pantalla apagada CONGELA el temporizador. Quien vuelve dos horas
 *      después veía el catálogo de hace dos horas. Por eso se refresca también al volver a
 *      la pestaña y al recuperar la conexión, y sólo si ya pasó la ventana.
 *   2. Mientras la pestaña está oculta no se programa nada: no hay nadie leyendo, y cada
 *      vuelta es batería y datos de alguien.
 *   3. El refresco COMPLETO se pide una vez por hora; el resto son parciales
 *      (`updatedafter`), que en el caso normal son una respuesta vacía en vez del catálogo
 *      entero cada cuarto de hora.
 *   4. Los contornos ya no se tiran en cada vuelta. Sólo se vuelven a bajar cuando cambia
 *      el evento principal o su revisión — antes la zona afectada parpadeaba y se
 *      re-descargaba sola cada 15 minutos.
 *
 * Y el intervalo lleva ±20% de jitter: mil personas que abrieron el mapa después del sismo
 * no tienen por qué golpear USGS todas en el mismo segundo, para siempre.
 *
 * Only the PRINCIPAL event's contours are fetched. Every aftershock having its own
 * overlapping footprint would be ~100 KB each for a picture nobody can read; the question
 * the layer exists to answer is about the main shock.
 */
export function useQuakes(): QuakeState {
  // De la fila, no del preset: una emergencia puede declarar su propia ventana de
  // tiempo, su magnitud mínima y qué capas arrancan encendidas.
  const site = useSite();
  const { storageKey } = useSiteHelpers();
  const SEISMIC = site.hazard.seismic;
  // Namespaceada por la emergencia resuelta: dos emergencias en el mismo navegador no
  // pueden compartir el catálogo de sismos de la otra.
  //
  // v2 porque las entradas de v1 no traen `updated`, que es de lo que ahora depende saber
  // si una huella sigue siendo la vigente. Se pierde una carga desde caché, una vez.
  const CACHE_KEY = storageKey("quakes:v2");
  const [state, setState] = useState<QuakeState>(() =>
    SEISMIC.enabled ? { ...EMPTY, loading: true } : EMPTY,
  );

  // Lo que sobrevive entre una vuelta y la siguiente. En refs y no en el estado porque el
  // bucle las LEE para decidir qué pedir, y leerlas del estado lo ataría a re-renderizados.
  const quakesRef = useRef<Quake[]>([]);
  const contoursRef = useRef<IntensityContour[]>([]);
  const contourForRef = useRef<string | null>(null);

  // Hydrate from the last successful load. In an effect, not a lazy initialiser:
  // localStorage does not exist during the server render, and seeding from it would make
  // the hydration markup disagree with the HTML.
  useEffect(() => {
    if (!SEISMIC.enabled || !site.features.offline) return;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Cached;
      if (!Array.isArray(parsed.quakes) || parsed.quakes.length === 0) return;
      const at = typeof parsed.at === "number" ? parsed.at : 0;
      const contours = Array.isArray(parsed.contours) ? parsed.contours : [];

      quakesRef.current = parsed.quakes;
      contoursRef.current = contours;
      contourForRef.current = typeof parsed.contourFor === "string" ? parsed.contourFor : null;

      // eslint-disable-next-line react-hooks/set-state-in-effect -- external store, see above
      setState((s) => ({
        ...s,
        quakes: parsed.quakes,
        contours,
        principal: principalQuake(parsed.quakes),
        // `at` se guardaba y no se leía: una caché de la semana pasada entraba como si
        // acabara de llegar. Ahora el panel puede decir de cuándo es lo que está pintando.
        updatedAt: at || null,
        stale: at > 0 && Date.now() - at > STALE_MS,
      }));
    } catch {
      /* a corrupt cache is not worth a crash; the fetch below replaces it */
    }
  }, []);

  useEffect(() => {
    if (!SEISMIC.enabled) return;
    const ac = new AbortController();
    const periodMs = Math.max(0, SEISMIC.refreshMinutes) * 60_000;

    let timer: number | undefined;
    let running = false;
    /** Last catalogue that came back from USGS this session. 0 = none yet. */
    let okAt = 0;
    /** Last FULL fetch. A partial refresh does not move it, so the resync still fires. */
    let fullAt = 0;

    function persist(at: number) {
      if (!site.features.offline) return;
      try {
        const payload: Cached = {
          at,
          quakes: quakesRef.current,
          contours: contoursRef.current,
          contourFor: contourForRef.current,
        };
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch {
        /* quota exceeded: we lose offline seismic data, nothing else */
      }
    }

    /**
     * The footprint of the principal event, fetched only when it is not the one we hold.
     *
     * A different EVENT drops the old contours immediately — the previous quake's shaking
     * drawn under a new one is a wrong answer to "did it reach us", and a wrong answer is
     * worse than none. A revision of the SAME event keeps them on screen while the new
     * ones come down the wire: they are a correction of what is already drawn, not a
     * contradiction of it.
     */
    async function syncContours(principal: Quake | null, at: number) {
      const wanted =
        principal !== null &&
        principal.hasShakemap &&
        principal.magnitude >= SEISMIC.contourMinMagnitude;

      if (!wanted) {
        if (contourForRef.current !== null || contoursRef.current.length > 0) {
          contoursRef.current = [];
          contourForRef.current = null;
          setState((s) => ({ ...s, contours: [] }));
        }
        return;
      }

      const rev = revision(principal);
      if (contourForRef.current === rev) return;

      if (eventOf(contourForRef.current) !== principal.id && contoursRef.current.length > 0) {
        contoursRef.current = [];
        setState((s) => ({ ...s, contours: [] }));
      }

      let contours: IntensityContour[] = [];
      try {
        contours = await fetchIntensityContours(principal, ac.signal);
      } catch {
        /* no footprint is survivable; the epicentres still say where it broke */
      }
      if (ac.signal.aborted || contours.length === 0) return;

      contoursRef.current = contours;
      contourForRef.current = rev;
      setState((s) => ({ ...s, contours }));
      persist(at);
    }

    async function load() {
      // Una sesión SIEMPRE arranca con un catálogo completo, aunque la caché sea de hace
      // diez minutos: pedir `updatedafter` sobre una caché vieja arrastra eventos que ya
      // se salieron de la ventana. La caché está para pintar al instante, no para ahorrar
      // la primera petición.
      const partial = okAt > 0 && quakesRef.current.length > 0 && Date.now() - fullAt < RESYNC_MS;

      try {
        const got = await fetchQuakes(SEISMIC, site, ac.signal, partial ? okAt : undefined);
        if (ac.signal.aborted) return;

        const quakes = partial ? mergeQuakes(quakesRef.current, got, SEISMIC.maxEvents) : got;
        const at = Date.now();
        okAt = at;
        if (!partial) fullAt = at;
        quakesRef.current = quakes;

        const principal = principalQuake(quakes);
        setState((s) => ({
          ...s,
          quakes,
          principal,
          loading: false,
          stale: false,
          updatedAt: at,
        }));
        persist(at);

        // The contours are a second, much larger round trip. The epicentres paint first
        // so the map is useful while the footprint is still coming down the wire.
        await syncContours(principal, at);
      } catch {
        if (ac.signal.aborted) return;
        // Keep whatever the cache painted and flag it rather than blanking the layer.
        setState((s) => ({ ...s, loading: false, stale: s.quakes.length > 0 }));
      }
    }

    function clear() {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }

    function schedule() {
      clear();
      if (periodMs <= 0 || ac.signal.aborted) return;
      if (document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => void tick(), periodMs * (0.8 + Math.random() * 0.4));
    }

    async function tick() {
      if (!running && !ac.signal.aborted) {
        running = true;
        try {
          await load();
        } finally {
          running = false;
        }
      }
      schedule();
    }

    /** Whether enough time has passed that what is on screen is worth replacing. */
    function due() {
      return periodMs > 0 && (okAt === 0 || Date.now() - okAt >= periodMs);
    }

    /**
     * Back on screen, or back online. Son la misma pregunta —«¿me perdí algo mientras no
     * estaba?»— y son el único momento en el que se puede alcanzar a un temporizador que
     * el sistema tuvo congelado.
     */
    function wake() {
      if (ac.signal.aborted) return;
      if (document.visibilityState !== "visible") {
        clear();
        return;
      }
      if (due()) void tick();
      else schedule();
    }

    void tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);

    return () => {
      ac.abort();
      clear();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
    };
  }, []);

  return state;
}
