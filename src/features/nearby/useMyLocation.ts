"use client";

import { useCallback, useEffect, useState } from "react";

// ───────────────────────────────────────────────────────────────────────────
// Dónde está quien mira, y qué se hace con eso.
//
// LA REGLA, y es la que hace publicable esta función en un mapa de emergencia: la
// posición NO SALE DEL TELÉFONO. No se manda al servidor, no entra en una consulta, no
// se escribe en localStorage, no se registra en analítica. Vive en memoria mientras la
// pestaña esté abierta y se va con ella. Sirve para UNA cosa: ordenar por distancia una
// lista que el navegador ya se descargó entera.
//
// Por eso el cálculo de distancia es en cliente (`distanceKm` de `domain/center`) y no
// una consulta PostGIS, que sería lo obvio y lo más rápido de escribir: una consulta
// «puntos a menos de 5 km de -10.6, -66.9» le cuenta al servidor —y a sus registros—
// dónde está una persona que abrió un mapa de refugios. En este país eso no es un dato
// técnico.
//
// EL CACHÉ DE MÓDULO, y por qué existe: el botón de «mi ubicación» del mapa ya pedía una
// posición por su cuenta. Con dos titulares del dato, tocar el botón y luego abrir
// «Cerca» disparaba una segunda petición: en el mejor caso el navegador la resuelve solo
// y tarda; en el peor vuelve a preguntar. Un único caché en el módulo hace que el
// segundo en llegar encuentre la posición ya puesta. Es estado compartido de proceso,
// como el registro del service worker, y no estado de React: quien lo lee se suscribe.
// ───────────────────────────────────────────────────────────────────────────

export interface Fix {
  lat: number;
  lng: number;
  /** `Date.now()` de cuándo se obtuvo. Se muestra, para no fingir precisión. */
  at: number;
}

/**
 * En qué punto está la petición.
 *
 * `denied` y `unavailable` están separados a propósito aunque se vean casi igual: lo
 * primero lo arregla quien mira (dando el permiso), lo segundo no. Decirle «da permiso»
 * a alguien que ya lo dio, y a quien le falló el GPS, es mandarlo a un ajuste que está
 * bien.
 */
export type LocateStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";

let cached: Fix | null = null;
const listeners = new Set<(fix: Fix | null) => void>();

/** Una posición recién obtenida, venga de donde venga. La comparten todos los lectores. */
export function rememberFix(lat: number, lng: number): void {
  cached = { lat, lng, at: Date.now() };
  for (const fn of listeners) fn(cached);
}

/** Olvidarla. Es lo que hace el botón de «dejar de usar mi ubicación». */
export function forgetFix(): void {
  cached = null;
  for (const fn of listeners) fn(null);
}

export function currentFix(): Fix | null {
  return cached;
}

/**
 * Cuánto vale una posición antes de volver a pedirla. Diez minutos: quien camina de un
 * refugio a un acopio no necesita un GPS nuevo cada vez que cambia de pestaña, y quien
 * se movió de verdad tiene el botón para refrescar.
 */
const FRESH_MS = 10 * 60 * 1000;

export interface MyLocation {
  fix: Fix | null;
  status: LocateStatus;
  /** Pide una posición. Si hay una fresca en el caché, no molesta al navegador. */
  request: () => void;
  /**
   * Lo mismo, pero se puede esperar: resuelve con la posición o con `null` si no se
   * pudo. Existe para las acciones que hacen algo EN CUANTO hay posición —el check-in de
   * un punto— y que sin esto costaban dos toques: uno para dar el permiso y otro para
   * volver a pulsar el botón que ya se había pulsado.
   */
  ensure: () => Promise<Fix | null>;
  /** La descarta y vuelve al estado inicial. */
  forget: () => void;
}

export function useMyLocation(): MyLocation {
  const [fix, setFix] = useState<Fix | null>(() => cached);
  const [status, setStatus] = useState<LocateStatus>(() => (cached ? "ready" : "idle"));

  // Suscripción al caché compartido: si el botón del mapa consigue una posición mientras
  // esta lista está montada, la lista se reordena sola.
  useEffect(() => {
    const fn = (next: Fix | null) => {
      setFix(next);
      setStatus(next ? "ready" : "idle");
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const request = useCallback(() => {
    if (cached && Date.now() - cached.at < FRESH_MS) {
      setFix(cached);
      setStatus("ready");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // `rememberFix` avisa a los suscritos, y este componente es uno: el `setStatus`
        // de la suscripción deja el estado en `ready` sin tocarlo aquí.
        rememberFix(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        // 1 = PERMISSION_DENIED. Los otros dos códigos (posición no disponible, tiempo
        // agotado) son fallos del aparato, no una decisión de quien mira.
        setStatus(err.code === 1 ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: FRESH_MS },
    );
  }, []);

  const ensure = useCallback((): Promise<Fix | null> => {
    if (cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }
    setStatus("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          rememberFix(pos.coords.latitude, pos.coords.longitude);
          resolve(cached);
        },
        (err) => {
          setStatus(err.code === 1 ? "denied" : "unavailable");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: FRESH_MS },
      );
    });
  }, []);

  const forget = useCallback(() => {
    forgetFix();
    setStatus("idle");
  }, []);

  return { fix, status, request, ensure, forget };
}
