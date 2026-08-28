// Assembling a `SiteConfig` from its parts.
//
// ── WHY THESE MERGES LIVE HERE ──────────────────────────────────────────────
//
// The rule this project is built on is that the shared kit holds what the network has in
// common and a country states only what it does differently — `config/brand.ts` merged one
// level into each nested group, `config/language.ts` merged per language AND per key.
//
// Those merges used to live inside the config files themselves, closed over the compiled
// preset. That worked while a process served exactly one country. Since
// `db/01_esquema.sql § 007_emergencies` it can resolve a different emergency per request, so the same
// merges have to run against a country that is not the compiled one.
//
// They are extracted rather than copied on purpose. "Merged per language and per key, so a
// country renaming refugio to albergue keeps the rest" is a decision with a reason behind
// it; a second copy for the database path is where that reason quietly stops being true.
//
// `config/brand.ts`, `config/language.ts` and `config/features.ts` now call these too, so
// the preset path and the row path are the same code.

import type {
  BrandConfig,
  BrandOverrides,
  CountryConfig,
  Deployment,
  DeploymentMode,
  FeatureConfig,
  HazardConfig,
  IntegrationsConfig,
  LanguageConfig,
  LanguageOverrides,
  MapConfig,
  SiteConfig,
} from "@/config/types";
import type { CopyOverrides } from "@/config/types";
import type { Lang } from "@/i18n/types";

/**
 * One level of merge inside each nested group, so `colors: { brand: "#c0392b" }` repaints
 * links without the preset restating the other ten colours.
 */
export function mergeBrand(base: BrandConfig, o: BrandOverrides): BrandConfig {
  return {
    ...base,
    ...o,
    colors: { ...base.colors, ...o.colors },
    radius: { ...base.radius, ...o.radius },
    font: { ...base.font, ...o.font },
    contact: { ...base.contact, ...o.contact },
  };
}

/**
 * Merged per language AND per key, not per whole language: a country that renames
 * "refugio" to "albergue" keeps every other override the base ships, and keeps inheriting
 * new ones as the base adds them.
 */
export function mergeLanguage(base: LanguageConfig, o: LanguageOverrides): LanguageConfig {
  const overrides: CopyOverrides = {};
  for (const lang of new Set([
    ...(Object.keys(base.overrides) as Lang[]),
    ...(Object.keys(o.overrides ?? {}) as Lang[]),
  ])) {
    overrides[lang] = { ...base.overrides[lang], ...o.overrides?.[lang] };
  }
  return {
    default: o.default ?? base.default,
    available: o.available ?? base.available,
    overrides,
  };
}

/** Flat: a module is on or off, there is nothing nested to preserve. */
export function mergeFeatures(
  base: FeatureConfig,
  o: Partial<FeatureConfig> | undefined,
): FeatureConfig {
  return { ...base, ...o };
}

export interface AssembleParts {
  mode: DeploymentMode;
  country: CountryConfig;
  /** The shared kit — the network's values, before this country's overrides. */
  baseBrand: BrandConfig;
  baseLanguage: LanguageConfig;
  baseFeatures: FeatureConfig;
  /** Brand overrides to apply INSTEAD of the country's own (the hub uses this). */
  brandOverride?: BrandOverrides;
  map: MapConfig;
  hazard: HazardConfig;
  integrations: IntegrationsConfig;
  network: Deployment[];
}

/**
 * Build the frozen `SiteConfig` a deployment renders from.
 *
 * Frozen for the same reason the preset one is: a stray assignment fails loudly instead of
 * drifting between renders — which matters more now that two of these can be alive in one
 * process at the same time.
 */
export function assembleSite(parts: AssembleParts): SiteConfig {
  const brandOverrides = parts.brandOverride ?? parts.country.brand ?? {};
  return Object.freeze({
    mode: parts.mode,
    country: parts.country,
    brand: mergeBrand(parts.baseBrand, brandOverrides),
    language: mergeLanguage(parts.baseLanguage, parts.country.language ?? {}),
    features: mergeFeatures(parts.baseFeatures, parts.country.features),
    map: parts.map,
    hazard: parts.hazard,
    integrations: parts.integrations,
    network: parts.network,
  });
}
