"use client";

import { useSyncExternalStore } from "react";
import { rememberFix } from "@/features/nearby/useMyLocation";

// ───────────────────────────────────────────────────────────────────────────
// «Cómo llegar» dentro de nuestro mapa.
//
// La app te ubica, dibuja la ruta por calles en nuestro mapa —a pie y en carro, con su
// distancia y su tiempo— y te sigue mientras te mueves. Lo que aporta es ver si el punto
// te queda cerca sin salir de la app; la navegación giro a giro se le deja a Google Maps
// y a Waze, que son quienes saben hacerla.
//
// La posición vive en memoria y se va al salir. Para la ruta viaja UNA vez a
// `api/route`, que la usa y la descarta (el porqué está allí). Si esa ruta falla queda la
// línea recta, calculada aquí, y lo dice.
//
// Un solo dueño del GPS, en el módulo y no en un componente: el mapa dibuja y la barra
// cuenta, y si cada uno tuviera su `watchPosition` el teléfono haría el trabajo dos veces
// con la batería de alguien que quizá no sabe cuándo podrá cargarla.
// ───────────────────────────────────────────────────────────────────────────

export interface GuideTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface GuideFix {
  lat: number;
  lng: number;
  /** Radio de error en metros, como lo da el GPS. */
  accuracy: number;
}

export type GuideStatus = "locating" | "tracking" | "denied" | "unavailable";

export interface RouteLeg {
  km: number;
  min: number;
  line: [number, number][];
}

export type TravelMode = "foot" | "car";

export interface GuideState {
  target: GuideTarget;
  fix: GuideFix | null;
  status: GuideStatus;
  route: { foot: RouteLeg | null; car: RouteLeg | null } | null;
  routeStatus: "idle" | "loading" | "ready" | "failed";
  mode: TravelMode;
}

/** Cuánto hay que alejarse de donde se calculó la ruta para volver a pedirla. */
const REROUTE_M = 300;
/** Hasta aquí se propone ir a pie; más lejos, en carro. */
const WALK_KM = 2;

let state: GuideState | null = null;
let watchId: number | null = null;
// Desde dónde se pidió la ruta vigente. Sólo en memoria, como todo lo demás.
let routedFrom: { lat: number; lng: number } | null = null;
let routeSeq = 0;
const listeners = new Set<() => void>();

function emit(next: GuideState | null) {
  state = next;
  for (const fn of listeners) fn();
}

function clearWatch() {
  if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
}

/** Empezar a guiar hacia un punto. Pide la ubicación aquí, en respuesta a un toque. */
export function startGuide(target: GuideTarget): void {
  clearWatch();
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    emit({ target, fix: null, status: "unavailable", route: null, routeStatus: "idle", mode: "foot" });
    return;
  }
  routedFrom = null;
  emit({ target, fix: null, status: "locating", route: null, routeStatus: "idle", mode: "foot" });
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!state) return;
      const fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      // La misma posición le sirve a «Cerca» y a «Estoy aquí»: llegar y marcarlo no tiene
      // que volver a pedir nada.
      rememberFix(fix.lat, fix.lng);
      emit({ ...state, fix, status: "tracking" });
      if (!routedFrom || metersBetween(routedFrom, fix) > REROUTE_M) void fetchRoute(fix);
    },
    (err) => {
      if (!state) return;
      // Un tiempo agotado con una posición ya en mano no es un fallo: el GPS sigue y la
      // siguiente lectura llegará. Sólo se avisa si nunca hubo ninguna.
      if (err.code !== 1 && state.fix) return;
      emit({ ...state, status: err.code === 1 ? "denied" : "unavailable" });
      if (err.code === 1) clearWatch();
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  );
}

async function fetchRoute(from: GuideFix) {
  if (!state) return;
  const target = state.target;
  routedFrom = { lat: from.lat, lng: from.lng };
  const seq = ++routeSeq;
  if (!state.route) emit({ ...state, routeStatus: "loading" });
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: { lat: from.lat, lng: from.lng },
        to: { lat: target.lat, lng: target.lng },
      }),
    });
    const data = (await res.json().catch(() => null)) as GuideState["route"];
    // Una respuesta vieja que llega tarde, o de un destino que ya no es éste, no pisa nada.
    if (!state || seq !== routeSeq || state.target.id !== target.id) return;
    if (!res.ok || !data || (!data.foot && !data.car)) {
      emit({ ...state, routeStatus: state.route ? "ready" : "failed" });
      return;
    }
    // La primera vez se elige el modo por la distancia; después, el que la persona tocó.
    const first = state.route === null;
    const mode: TravelMode = first
      ? data.foot && data.foot.km <= WALK_KM
        ? "foot"
        : data.car
          ? "car"
          : "foot"
      : state.mode;
    emit({ ...state, route: data, routeStatus: "ready", mode });
  } catch {
    if (!state || seq !== routeSeq) return;
    emit({ ...state, routeStatus: state.route ? "ready" : "failed" });
  }
}

export function setTravelMode(mode: TravelMode): void {
  if (state) emit({ ...state, mode });
}

/** Dejar de guiar. Apaga el GPS: nada sigue leyendo la posición después de salir. */
export function stopGuide(): void {
  clearWatch();
  routedFrom = null;
  routeSeq++;
  emit(null);
}

/** El estado sin suscribirse, para quien sólo necesita mirarlo en un momento. */
export function currentGuide(): GuideState | null {
  return state;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useGuide(): GuideState | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
}

// ── Las cuentas ─────────────────────────────────────────────────────────────

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Los enlaces para seguir paso a paso en la app de navegación de cada quien. */
export function googleMapsUrl(t: { lat: number; lng: number }, mode: TravelMode): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=${mode === "foot" ? "walking" : "driving"}`;
}

export function wazeUrl(t: { lat: number; lng: number }): string {
  return `https://waze.com/ul?ll=${t.lat},${t.lng}&navigate=yes`;
}

/**
 * Minutos a pie, aproximados. La calle nunca es la recta: se cuenta un 30 % más de
 * camino, a 4,5 km/h, que es el paso de alguien que no conoce la zona.
 */
export function walkMinutes(km: number): number {
  return Math.max(1, Math.round(((km * 1.3) / 4.5) * 60));
}

/**
 * ¿Llegó? A menos de 60 m, o dentro del margen de error del GPS si el GPS no da para más
 * (hasta 150 m). Con un margen de 200 m decir «llegaste» sería adivinar.
 */
export function hasArrived(meters: number, accuracy: number): boolean {
  return meters <= Math.max(60, Math.min(accuracy, 150));
}
