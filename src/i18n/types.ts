export type Lang = "es" | "en" | "pt";

export const LANGS: Lang[] = ["es", "en", "pt"];

export function isLang(v: unknown): v is Lang {
  return v === "es" || v === "en" || v === "pt";
}

/** Narrow an untrusted value (query string, header) to a language this tenant offers. */
export function pickLang(value: unknown, available: Lang[], fallback: Lang): Lang {
  return isLang(value) && available.includes(value) ? value : fallback;
}
