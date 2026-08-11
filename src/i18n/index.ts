import type { Lang } from "@/i18n/types";
import { pickLang } from "@/i18n/types";
import { LANGUAGE } from "@/config";
import es from "@/i18n/dictionaries/es";
import en from "@/i18n/dictionaries/en";
import pt from "@/i18n/dictionaries/pt";

/**
 * Every key the UI can ask for. Spanish is the base and the only complete dictionary;
 * the others are partial and fall back key by key, so a missing translation renders
 * real Spanish copy instead of a raw key like `center.needsTitle`.
 */
export type Dict = Record<keyof typeof es, string>;
export type DictKey = keyof Dict;

const PARTIALS: Record<Lang, Partial<Dict>> = { es: {}, en, pt };

const CACHE = new Map<Lang, Dict>();

/**
 * Deployment-level copy overrides come from `config/language.ts` and win over both the
 * base and the translation. That is what lets a clone rename "refugio" to "albergue"
 * without editing this folder — and therefore without a merge conflict every time it
 * pulls from the base repo.
 */
export function getDict(lang: Lang): Dict {
  const cached = CACHE.get(lang);
  if (cached) return cached;
  const overrides = LANGUAGE.overrides[lang] ?? {};
  const merged = { ...es, ...PARTIALS[lang], ...overrides } as Dict;
  CACHE.set(lang, merged);
  return merged;
}

export type Translate = (key: DictKey, vars?: Record<string, string | number>) => string;

/** `t("needs.barCount", { n: 4 })` replaces every `{n}` in the string. */
export function makeT(dict: Dict): Translate {
  return (key, vars) => {
    const raw: string = dict[key] ?? String(key);
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
    );
  };
}

/** Translator for a language, ready to use in a server component. */
export function translator(lang: Lang): Translate {
  return makeT(getDict(lang));
}

/** Narrow an untrusted value (query string, cookie) to a language this clone offers. */
export function resolveLang(value: unknown): Lang {
  return pickLang(value, LANGUAGE.available, LANGUAGE.default);
}

export { es as baseDict };
