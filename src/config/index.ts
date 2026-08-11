import country from "~/config/country";
import brand from "~/config/brand";
import language from "~/config/language";
import features from "~/config/features";
import map from "~/config/map";
import hazard from "~/config/hazard";
import integrations from "~/config/integrations";
import network from "~/config/network";
import mode from "~/config/deployment";
import type {
  Deployment,
  FeatureConfig,
  PointTypeStyle,
  Region,
  SiteConfig,
} from "@/config/types";
import type { LocationType } from "@/domain/types";

/**
 * The assembled configuration for this deployment.
 *
 * Safe to import anywhere — server components, client components, route handlers, image
 * routes — because it is plain data resolved at build time, not a request-scoped lookup.
 * Frozen so a stray assignment fails loudly instead of drifting between renders.
 */
export const SITE: SiteConfig = Object.freeze({
  mode,
  country,
  brand,
  language,
  features,
  map,
  hazard,
  integrations,
  network,
});

export const COUNTRY = SITE.country;
export const BRAND = SITE.brand;
export const FEATURES = SITE.features;
export const MAPCFG = SITE.map;
export const LANGUAGE = SITE.language;
export const NETWORK = SITE.network;
export const SEISMIC = SITE.hazard.seismic;

/**
 * The box the seismic catalogue is queried over. Defaults to the country bounds: the
 * shaking that matters on this deployment is the shaking that reached this country.
 */
export function seismicBounds(): [[number, number], [number, number]] {
  return SEISMIC.bounds ?? COUNTRY.geo.bounds;
}

export type { SiteConfig, Region, Deployment, PointTypeStyle };

/** True on helpmaps.net itself (the network hub), false on a country deployment. */
export const IS_HUB = SITE.mode === "hub";

export function hasFeature(name: keyof FeatureConfig): boolean {
  return SITE.features[name];
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

const REGION_BY_CODE = new Map(COUNTRY.regions.map((r) => [r.code, r]));

export function regionByCode(code: string | null | undefined): Region | null {
  return code ? REGION_BY_CODE.get(code) ?? null : null;
}

/** Display name for a region code, falling back to the raw code rather than blank. */
export function regionLabel(code: string | null | undefined): string {
  if (!code) return "";
  return REGION_BY_CODE.get(code)?.name ?? code;
}

/**
 * Regions are stored as free text (no per-country enum, deliberately — see db/001).
 * The trade-off is that a hand-written SQL insert can carry a code the app doesn't
 * know; this is how the admin panel finds those rows instead of silently dropping them
 * from the region filter.
 */
export function isKnownRegion(code: string | null | undefined): boolean {
  return Boolean(code && REGION_BY_CODE.has(code));
}

// ---------------------------------------------------------------------------
// Point types
// ---------------------------------------------------------------------------

export function typeStyle(type: LocationType): PointTypeStyle {
  return SITE.map.types[type];
}

export function isTypeEnabled(type: LocationType): boolean {
  return SITE.map.types[type]?.enabled ?? false;
}

/** Enabled point types in display order — drives chips, legends and grouped selects. */
export function enabledTypes(): LocationType[] {
  return (Object.keys(SITE.map.types) as LocationType[])
    .filter((t) => SITE.map.types[t].enabled)
    .sort((a, b) => SITE.map.types[a].order - SITE.map.types[b].order);
}

// ---------------------------------------------------------------------------
// URLs and storage
// ---------------------------------------------------------------------------

/**
 * Canonical absolute origin. NEXT_PUBLIC_SITE_URL wins (previews, local dev), otherwise
 * the configured host — so share links and OG images are right with no extra setup.
 */
export function siteUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  return `https://${COUNTRY.host}`;
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Namespaced so two country clones never collide in one browser's storage. */
export function storageKey(name: string): string {
  return `helpmaps:${COUNTRY.slug}:${name}`;
}
