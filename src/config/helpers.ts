// Helpers bound to one assembled `SiteConfig`.
//
// ── WHY THIS IS A FACTORY AND NOT A SET OF MODULE-LEVEL FUNCTIONS ────────────
//
// Until now there was exactly one configuration per process — the preset chosen at build
// time — so these could close over it directly, and `src/config/index.ts` did that.
//
// With `db/01_esquema.sql § 007_emergencies` a deployment can serve more than one emergency, each one
// resolved per request from the host. That means the same process needs two or more sets
// of these helpers alive at once: one per resolved site.
//
// The alternative was to duplicate the logic for the database path and keep both copies in
// step by hand. `regionLabel` falling back to the raw code, `enabledTypes` sorting by
// `order`, `storageKey` namespacing by slug — each of those is a decision someone made for
// a reason, and a second copy is where those reasons go to rot.
//
// So: one implementation, parameterised by the site it belongs to. `index.ts` builds the
// preset-bound instance and re-exports it, so every existing import keeps working exactly
// as before.

import { HUB_HOST } from "~/config/network";
import type {
  FeatureConfig,
  PointTypeStyle,
  Region,
  SiteConfig,
} from "@/config/types";
import type { LocationType } from "@/domain/types";

export interface SiteHelpers {
  /** True on helpmaps.net itself (the network hub), false on a country deployment. */
  isHub: boolean;
  hasFeature(name: keyof FeatureConfig): boolean;
  /** The box the seismic catalogue is queried over. Defaults to the country bounds. */
  seismicBounds(): [[number, number], [number, number]];
  regionByCode(code: string | null | undefined): Region | null;
  regionLabel(code: string | null | undefined): string;
  isKnownRegion(code: string | null | undefined): boolean;
  typeStyle(type: LocationType): PointTypeStyle;
  isTypeEnabled(type: LocationType): boolean;
  enabledTypes(): LocationType[];
  /** `enabledTypes()` minus `digital`: the types that are PLACES and get a pin and a chip. */
  pinTypes(): LocationType[];
  siteUrl(): string;
  absoluteUrl(path: string): string;
  storageKey(name: string): string;
}

export function createSiteHelpers(site: SiteConfig): SiteHelpers {
  const isHub = site.mode === "hub";

  // Built once per site rather than on every lookup: the region filter calls this for
  // every row it renders.
  const regionByCodeMap = new Map(site.country.regions.map((r) => [r.code, r]));

  function enabledTypes(): LocationType[] {
    return (Object.keys(site.map.types) as LocationType[])
      .filter((t) => site.map.types[t].enabled)
      .sort((a, b) => site.map.types[a].order - site.map.types[b].order);
  }

  function siteUrl(): string {
    // NEXT_PUBLIC_SITE_URL wins (previews, local dev), otherwise the configured host — so
    // share links and OG images are right with no extra setup.
    //
    // The hub has no country, so it uses HUB_HOST. Falling back to the default country's
    // host here published helpmaps.net's sitemap and canonicals as co.helpmaps.net.
    const env = process.env.NEXT_PUBLIC_SITE_URL;
    if (env) return env.replace(/\/$/, "");
    return `https://${isHub ? HUB_HOST : site.country.host}`;
  }

  return {
    isHub,

    hasFeature(name) {
      return site.features[name];
    },

    seismicBounds() {
      return site.hazard.seismic.bounds ?? site.country.geo.bounds;
    },

    regionByCode(code) {
      return code ? regionByCodeMap.get(code) ?? null : null;
    },

    /** Display name for a region code, falling back to the raw code rather than blank. */
    regionLabel(code) {
      if (!code) return "";
      return regionByCodeMap.get(code)?.name ?? code;
    },

    /**
     * Regions are stored as free text (no per-country enum, deliberately — see db/001).
     * The trade-off is that a hand-written SQL insert can carry a code the app doesn't
     * know; this is how the admin panel finds those rows instead of silently dropping
     * them from the region filter.
     */
    isKnownRegion(code) {
      return Boolean(code && regionByCodeMap.has(code));
    },

    typeStyle(type) {
      return site.map.types[type];
    },

    isTypeEnabled(type) {
      return site.map.types[type]?.enabled ?? false;
    },

    /** Enabled point types in display order — drives chips, legends and grouped selects. */
    enabledTypes() {
      return enabledTypes();
    },

    /**
     * The types that are places. A digital initiative is enabled (it has a colour, a
     * glyph, a type label) but it is not a pin: it has no coordinates, it is not one of
     * the five chips over the list, and it does not join the cluster fan. It lives in
     * its own tab.
     */
    pinTypes() {
      return enabledTypes().filter((t) => t !== "digital");
    },

    siteUrl,

    absoluteUrl(path) {
      return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
    },

    /** Namespaced so two country clones never collide in one browser's storage. */
    storageKey(name) {
      return `helpmaps:${site.country.slug}:${name}`;
    },
  };
}
