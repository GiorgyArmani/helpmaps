import { useSyncExternalStore } from "react";
import { storageKey } from "@/config";

// ── LA ELECCIÓN SOBRE COOKIES ───────────────────────────────────────────────
//
// Lo único de esta aplicación que necesita permiso es la analítica: la sesión, el paso por
// la portada, el idioma y las cachés son necesarias o las pidió la propia persona, y la
// norma (RGPD + art. 22.2 LSSI en España, art. 5.3 de la directiva ePrivacy) las exime.
// Google Analytics no: por eso `Analytics` no descarga NI el script hasta que aquí diga
// `granted`. El modo de consentimiento en `denied` no bastaba — gtag.js llegaba a Google
// en cada visita y mandaba avisos con la IP antes de que nadie eligiera nada.
//
// La elección se guarda en ESTE navegador y en este país (`storageKey`), y caduca a los
// 12 meses: la AEPD pide volver a preguntar pasado un tiempo razonable y nunca más de 24.
// Si el almacenamiento está bloqueado se recuerda en memoria mientras dure la pestaña, para
// no volver a enseñar el aviso tras cada toque.

export type Consent = "granted" | "denied";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const KEY = storageKey("consent:v1");
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const CHANGE_EVENT = "helpmaps:consent-change";

/** Lo emite «Cookies» en los pies de página para volver a abrir el aviso. */
export const CONSENT_OPEN_EVENT = "helpmaps:consent-open";

let memory: Consent | null = null;

export function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return memory;
    const { v, at } = JSON.parse(raw) as { v?: unknown; at?: unknown };
    if (v !== "granted" && v !== "denied") return memory;
    if (typeof at !== "string" || Date.now() - Date.parse(at) > MAX_AGE_MS) return null;
    return v;
  } catch {
    return memory;
  }
}

export function saveConsent(value: Consent) {
  memory = value;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: value, at: new Date().toISOString() }));
  } catch {
    /* modo privado: vale lo que quedó en memoria */
  }
  // Si gtag ya está cargado (alguien acepta, rechaza y vuelve a aceptar sin recargar), el
  // cambio se le comunica a él; retirar el componente no descarga un script ya ejecutado.
  window.gtag?.("consent", "update", { analytics_storage: value });
  if (value === "denied") dropAnalyticsCookies();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function openConsent() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Otra pestaña del mismo país que cambia la elección.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `null` = todavía no ha elegido (o su elección caducó). En el servidor, siempre `null`. */
export function useConsent(): Consent | null {
  return useSyncExternalStore(subscribe, readConsent, () => null);
}

/**
 * Retirar el permiso tiene que borrar lo que dejó. GA escribe `_ga` y `_ga_<id>` en el
 * dominio más alto que puede (`.helpmaps.net`, `.helpmapvzla.net`), así que se prueba en el
 * host y en cada dominio padre: una cookie sólo se borra con el mismo `domain` con que se
 * escribió, y desde aquí no se puede leer cuál fue.
 */
function dropAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => (c.split("=")[0] ?? "").trim())
    .filter((n) => n === "_ga" || n.startsWith("_ga_") || n === "_gid");
  if (names.length === 0) return;

  const labels = window.location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < labels.length - 1; i++) domains.push(`; domain=.${labels.slice(i).join(".")}`);

  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}
