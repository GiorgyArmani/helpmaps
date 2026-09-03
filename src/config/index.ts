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
import { validateConfig } from "@/config/validate";
import { createSiteHelpers } from "@/config/helpers";

/**
 * The assembled configuration for THIS BUILD — the compiled preset.
 *
 * Safe to import anywhere — server components, client components, route handlers, image
 * routes — because it is plain data resolved at build time, not a request-scoped lookup.
 * Frozen so a stray assignment fails loudly instead of drifting between renders.
 *
 * ── ON DEPLOYMENTS THAT SERVE MORE THAN ONE EMERGENCY ──────────────────────
 *
 * Since `db/01_esquema.sql § 007_emergencies` a deployment can resolve its configuration from a row
 * instead, chosen per request from the host. Where that happens this object is the
 * FALLBACK: with no matching row the preset wins and the deployment behaves exactly as it
 * did before that migration.
 *
 * Everything exported below is bound to this preset. Code that must honour the
 * per-request emergency reads it from `getSite()` on the server or `useSite()` on the
 * client instead; both hand back the same `SiteConfig` shape and the same helpers, so a
 * call site migrates without changing what it says.
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

// Se revisa al ensamblar, no bajo demanda: un preset a medio llenar tiene que romper el
// build de quien lo despliega, no esperar a la primera persona que abra el mapa. Lanza
// solo en servidor — ver la nota de `validate.ts`.
validateConfig(SITE);

export const COUNTRY = SITE.country;
export const BRAND = SITE.brand;
export const FEATURES = SITE.features;
export const MAPCFG = SITE.map;
export const LANGUAGE = SITE.language;
export const NETWORK = SITE.network;
export const SEISMIC = SITE.hazard.seismic;

// Los ayudantes ligados al preset. La implementación vive en `helpers.ts` para que la ruta
// de base de datos use exactamente la misma y no queden dos copias que se separen.
const H = createSiteHelpers(SITE);

/** True on helpmaps.net itself (the network hub), false on a country deployment. */
export const IS_HUB = H.isHub;

export const seismicBounds = H.seismicBounds;
export const hasFeature = H.hasFeature;
export const regionByCode = H.regionByCode;
export const regionLabel = H.regionLabel;
export const isKnownRegion = H.isKnownRegion;
export const typeStyle = H.typeStyle;
export const isTypeEnabled = H.isTypeEnabled;
export const enabledTypes = H.enabledTypes;
export const pinTypes = H.pinTypes;
export const siteUrl = H.siteUrl;
export const absoluteUrl = H.absoluteUrl;
export const storageKey = H.storageKey;

export { createSiteHelpers };
export type { SiteHelpers } from "@/config/helpers";
export type { SiteConfig, Region, Deployment, PointTypeStyle, FeatureConfig };
