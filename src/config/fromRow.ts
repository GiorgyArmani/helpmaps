// Turning an `emergencies` row into the configuration the application renders from.
//
// This is the whole point of `db/007_emergencies.sql` in one file: the row holds the same
// `CountryConfig` the presets hold, so becoming a `SiteConfig` is a mapping, not a
// translation. If this file ever starts making decisions — defaulting a viewport, guessing
// a region list — the shapes have drifted apart and the fix belongs in the schema.
//
// What the row does NOT carry is the shared kit: the map style, the seismic defaults, the
// integrations and the network list stay compiled, because they belong to the network and
// not to any one emergency. The row carries what a country states differently, exactly as
// a preset does.

import { assembleSite } from "@/config/assemble";
import { parseLayers, type EmergencyLayer } from "@/domain/layers";
import { parseNewsConfig, type NewsConfig } from "@/domain/news";
import { BASE_BRAND } from "~/config/brand";
import { BASE_FEATURES } from "~/config/features";
import { BASE_LANGUAGE } from "~/config/language";
import map from "~/config/map";
import hazard from "~/config/hazard";
import integrations from "~/config/integrations";
import network from "~/config/network";
import type {
  BrandOverrides,
  CountryConfig,
  CountryGeo,
  CountryLegal,
  FeatureConfig,
  HazardConfig,
  LanguageOverrides,
  Region,
  SiteConfig,
} from "@/config/types";

/** The row as it comes back from the database, before any shaping. */
export interface EmergencyRow {
  id: string;
  slug: string;
  host: string | null;
  country_code: string;
  country_name: string;
  name: string;
  hazard_type: string;
  status: "draft" | "active" | "archived";
  region_noun: { one: string; many: string };
  geo: CountryGeo;
  regions: Region[];
  legal: CountryLegal;
  brand: BrandOverrides;
  features: Partial<FeatureConfig>;
  language: LanguageOverrides;
  hazard: Partial<HazardConfig>;
  layers: unknown[];
  news: unknown;
  maintenance: boolean;
  notice: string | null;
}

/**
 * The identity and operating state of an emergency, without its configuration.
 *
 * Split out from `ResolvedEmergency` because this is the half that crosses into client
 * components: the panel and the map need the id to scope their queries, and the operating
 * state to know whether to show the maintenance banner. It is deliberately small and
 * plain — everything here has to survive serialisation across the server boundary.
 */
export interface EmergencyIdentity {
  id: string;
  slug: string;
  /** The event, not the country — "Terremoto de Venezuela 2026". */
  name: string;
  hazardType: string;
  status: EmergencyRow["status"];
  maintenance: boolean;
  notice: string | null;
  /** Extra overlays this emergency declares, already validated. */
  layers: EmergencyLayer[];
  /** Press feeds and the relevance filter for this emergency's bulletin. */
  news: NewsConfig;
}

/**
 * The emergency as the application thinks about it: its configuration, plus the operating
 * state that is not part of `SiteConfig` because it changes hourly rather than per deploy.
 */
export interface ResolvedEmergency extends EmergencyIdentity {
  site: SiteConfig;
}

function toCountry(row: EmergencyRow): CountryConfig {
  return {
    slug: row.slug,
    code: row.country_code,
    // The COUNTRY, not the event: this is what brand copy and metadata read.
    name: row.country_name,
    // A row with no host is not served by any domain yet (an emergency being prepared).
    // The empty string keeps the shape total; `siteUrl()` only reaches for it when
    // NEXT_PUBLIC_SITE_URL is unset, which is not the case for a draft being previewed.
    host: row.host ?? "",
    regionNoun: row.region_noun,
    geo: row.geo,
    regions: row.regions,
    legal: row.legal,
    brand: row.brand,
    features: row.features,
    language: row.language,
  };
}

/**
 * Merge the emergency's seismic overrides over the network defaults.
 *
 * Kept shallow on purpose, like every other override in this project: an emergency states
 * the magnitude floor or the window it cares about, not the whole block.
 */
function toHazard(row: EmergencyRow): HazardConfig {
  const o = row.hazard ?? {};
  return {
    seismic: { ...hazard.seismic, ...o.seismic },
  };
}

export function emergencyFromRow(row: EmergencyRow): ResolvedEmergency {
  const country = toCountry(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    hazardType: row.hazard_type,
    status: row.status,
    maintenance: row.maintenance,
    notice: row.notice,
    layers: parseLayers(row.layers),
    news: parseNewsConfig(row.news),
    site: assembleSite({
      // A row is always a country deployment. The hub is the network's own front page and
      // is chosen by NEXT_PUBLIC_MODE, never by a row.
      mode: "country",
      country,
      baseBrand: BASE_BRAND,
      baseLanguage: BASE_LANGUAGE,
      baseFeatures: BASE_FEATURES,
      map,
      hazard: toHazard(row),
      integrations,
      network,
    }),
  };
}
