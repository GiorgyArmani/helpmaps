"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { pickLang, type Lang } from "@/i18n/types";
import { getDict, makeT, type Translate } from "@/i18n";
import { useSite, useSiteHelpers } from "@/features/app/SiteProvider";

interface I18nValue {
  lang: Lang;
  t: Translate;
  setLang: (lang: Lang) => void;
  available: Lang[];
}

const Ctx = createContext<I18nValue | null>(null);


/**
 * Language state for the client tree.
 *
 * The choice is PERSISTED. The first deployment reset to Spanish on every reload, which
 * meant a non-Spanish reader re-picked their language every time they came back to a
 * shared link — small on a laptop, hostile on a phone with one bar.
 *
 * `initial` comes from the server (the `?lang=` on a shared link) so the first paint is
 * already right and there is no flash of the wrong language.
 */
export function I18nProvider({
  initial,
  children,
}: {
  initial: Lang;
  children: React.ReactNode;
}) {
  // Idioma y clave de almacenamiento salen de la emergencia RESUELTA: un país puede
  // declarar otro idioma por defecto y otra lista de idiomas ofrecidos, y con el preset
  // compilado esa declaración no llegaba a la interfaz. El proveedor vive dentro de
  // `SiteProvider` (ver `app/layout.tsx`), así que estos hooks están disponibles.
  const site = useSite();
  const { storageKey } = useSiteHelpers();
  const LANG_KEY = storageKey("lang");
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* not worth interrupting anyone over */
    }
    document.documentElement.lang = next;
  }, []);

  // Same reason as the data cache: localStorage is not readable during server render, so
  // the saved choice can only be applied after mount.
  //
  // El `?lang=` del enlace NO lo aplica el servidor. Un layout de App Router no recibe
  // `searchParams` —solo las páginas—, así que `initial` es siempre el idioma por defecto
  // de la emergencia. Antes esto se leía como "el enlace ya vino resuelto" y el efecto se
  // limitaba a NO pisarlo: el resultado era que `?lang=en` no hacía absolutamente nada,
  // ni acá ni desde el almacenamiento. Se aplica acá, y manda sobre lo guardado: quien
  // comparte un enlace con idioma lo eligió para quien lo recibe, no para sí mismo.
  //
  // La lista de idiomas sale de la emergencia RESUELTA y no de `resolveLang`, que mira el
  // preset compilado: un país que declara otro idioma por defecto no lo veía respetado.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { available, default: fallback } = site.language;
    const asked = new URL(window.location.href).searchParams.get("lang");
    if (asked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL, external store
      setLang(pickLang(asked, available, fallback));
      return;
    }
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      // `setLang` y no `setLangState`: también hay que corregir el `lang` del <html>, que
      // el servidor pintó con el idioma por defecto. Sin eso un lector de pantalla
      // anuncia texto en inglés con voz en español.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external store, see above
      if (saved) setLang(pickLang(saved, available, fallback));
    } catch {
      // Private mode / storage disabled: the default language is a fine outcome.
    }
    // Solo al montar. Volver a correr esto al cambiar cualquier dependencia pisaría la
    // elección de quien acaba de tocar el selector con lo que diga la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, t: makeT(getDict(lang)), setLang, available: site.language.available }),
    [lang, setLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n() must be used inside <I18nProvider>");
  return v;
}

/** Relative time in the reader's language. Coarse on purpose: exact minutes read as
 *  precision the data does not have. */
export function useTimeAgo(): (iso: string | null | undefined) => string {
  const { t } = useI18n();
  return useCallback(
    (iso) => {
      if (!iso) return "";
      const ms = Date.now() - Date.parse(iso);
      if (Number.isNaN(ms)) return "";
      const min = Math.floor(ms / 60000);
      if (min < 2) return t("time.now");
      if (min < 60) return t("time.minutes", { n: min });
      const h = Math.floor(min / 60);
      if (h < 24) return t("time.hours", { n: h });
      const d = Math.floor(h / 24);
      if (d === 1) return t("time.oneDay");
      return t("time.days", { n: d });
    },
    [t],
  );
}
