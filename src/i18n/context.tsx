"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Lang } from "@/i18n/types";
import { getDict, makeT, resolveLang, type Translate } from "@/i18n";
import { LANGUAGE, storageKey } from "@/config";

interface I18nValue {
  lang: Lang;
  t: Translate;
  setLang: (lang: Lang) => void;
  available: Lang[];
}

const Ctx = createContext<I18nValue | null>(null);

const LANG_KEY = storageKey("lang");

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
  const [lang, setLangState] = useState<Lang>(initial);

  // Same reason as the data cache: localStorage is not readable during server render, so
  // the saved choice can only be applied after mount.
  useEffect(() => {
    // Only consult storage when the link itself did not ask for a language.
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("lang")) return;
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external store, see above
      if (saved) setLangState(resolveLang(saved));
    } catch {
      // Private mode / storage disabled: the default language is a fine outcome.
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
    } catch {
      /* not worth interrupting anyone over */
    }
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, t: makeT(getDict(lang)), setLang, available: LANGUAGE.available }),
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
