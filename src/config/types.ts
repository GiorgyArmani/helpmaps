// The configuration kit.
//
// This repo is the maintained base: every country deployment is a clone of it, and the
// ONLY thing that differs between clones lives in `config/`. Nothing under `src/` may
// hardcode a country, a colour, a language, a hostname or a piece of copy.
//
// The kit is split by concern so a clone can adopt upstream changes to one section
// without re-resolving conflicts in the others:
//
//   config/country.ts       where it is        identity, regions, map viewport, law
//   config/brand.ts         how it looks       name, colours, logo, contact channels
//   config/language.ts      how it speaks      default language + per-clone copy overrides
//   config/features.ts      what it offers     module switches
//   config/map.ts           how the map reads  tiles, point types, colours, clustering
//   config/integrations.ts  what it talks to   analytics, email, partner feeds, PWA
//   config/network.ts       the HelpMaps net   every live deployment (drives the hub map)
//   config/deployment.ts    which mode         "country" app or the helpmaps.net hub
//
// Assembled and frozen by `src/config/index.ts` as `SITE`.

import type { Lang } from "@/i18n/types";
import type { LocationType } from "@/domain/types";

// ---------------------------------------------------------------------------
// Country — where this deployment is
// ---------------------------------------------------------------------------

/** A first-level administrative division: departamento (CO), estado (VE), province… */
export interface Region {
  /** Stable machine code, snake_case, never displayed. Stored in `locations.region`. */
  code: string;
  name: string;
  /** Approximate centroid — moves the viewport when filtered. Never places a pin. */
  lat: number;
  lng: number;
  /** Per-region zoom (a capital district needs more than a rural province). */
  zoom?: number;
}

export interface CountryGeo {
  center: [number, number];
  zoom: number;
  /** Zoom used when one region is selected and it defines no zoom of its own. */
  regionZoom: number;
  /** [[south, west], [north, east]] — bounds the map and biases geocoding. */
  bounds: [[number, number], [number, number]];
  /** ISO 3166-1 alpha-2 lowercased, passed to Nominatim as `countrycodes`. */
  geocodeCountry: string;
}

export interface CountryLegal {
  /** The organisation that answers for this data. */
  controller: string;
  privacyEmail: string;
  /** The data-protection law cited on the privacy page. */
  dataLaw: string;
  jurisdiction: string;
}

export interface CountryConfig {
  /** Short id: DB stamp, cache namespace, preset filename ("co", "ve"). */
  slug: string;
  /** ISO 3166-1 alpha-2, uppercase. */
  code: string;
  name: string;
  /** Canonical hostname of this clone, no scheme. */
  host: string;
  /** What a first-level division is called here. Labels every region filter. */
  regionNoun: { one: string; many: string };
  geo: CountryGeo;
  regions: Region[];
  legal: CountryLegal;

  // -------------------------------------------------------------------------
  // Per-country overrides of the shared kit.
  //
  // These three are what let one repository serve every country from one branch.
  // `config/brand.ts`, `config/features.ts` and `config/language.ts` hold the values the
  // whole network shares; what a single country does differently is stated HERE, next to
  // that country, and merged over the shared file at assembly time.
  //
  // Without this the shared files are the country's: Colombia's logo shipped to every
  // clone, and telling Venezuela apart meant forking the repo — which then owes a merge
  // on every upstream fix, in exactly the files it just edited.
  //
  // Say only what differs. Anything omitted follows the base and keeps following it.
  // -------------------------------------------------------------------------

  /** Logo, colours, contact channels this country does differently. */
  brand?: BrandOverrides;
  /** Modules this country turns on or off against the base. */
  features?: Partial<FeatureConfig>;
  /** Reading language and local vocabulary. */
  language?: LanguageOverrides;
  /** Seismic thresholds this country reads differently from the network default. */
  hazard?: HazardOverrides;
}

// ---------------------------------------------------------------------------
// Brand — how this deployment looks and who to write to
// ---------------------------------------------------------------------------

/**
 * The palette, in the same shape the HelpMap design system uses. The UI chrome is a
 * near-black `accent` over white surfaces on purpose: the colour on this screen belongs
 * to the map — the point types — and chrome that competes with it makes the pins harder
 * to read. `brand` is the country's own colour, used for links and highlights.
 */
export interface BrandColors {
  /** Body text. */
  ink: string;
  /** Secondary text, icons, placeholders. */
  muted: string;
  /** Hairlines and borders. */
  line: string;
  /** Subtle fills: notes, inactive segments. */
  soft: string;
  /** One step stronger: avatars, pressed states. */
  soft2: string;
  /** Chrome/action colour: active chips, primary buttons, selected pins. */
  accent: string;
  /** The country's colour, for links and accents. Also the PWA theme colour. */
  brand: string;
  /** Confirmed / open. */
  ok: string;
  /** Informational (focus rings, staff surfaces). */
  info: string;
  /** Unknown / inactive. */
  neutral: string;
  /** Closed, destructive, maintenance. */
  danger: string;
}

export interface BrandConfig {
  /**
   * The PLATFORM this deployment belongs to — "HelpMaps", not "HelpMaps Colombia".
   *
   * The distinction matters and copy gets it wrong constantly. `name` is this
   * deployment ("HelpMaps Colombia" publishes shelters in Chocó); `platform` is the
   * shared thing every clone is an instance of ("HelpMaps is an open civic platform",
   * "deploy HelpMaps in your country", "the HelpMaps public API"). Documentation almost
   * always means the second, which is why writing `name` there reads as if the whole
   * project belonged to one country — and hardcoding a literal means a fork that renames
   * the platform has to hunt through prose in twenty files.
   */
  platform: string;
  /** Product name in the header, metadata and share cards. */
  name: string;
  /** Short label for tight spots (tab title, share images). */
  short: string;
  /** One-line description for metadata and the entry page. */
  tagline: string;
  /** Path under /public, or null to render the wordmark only. */
  logo: string | null;
  /** Emoji fallback used for the favicon and small badges. */
  emoji: string;
  colors: BrandColors;
  /** Corner radius scale in px — the cheapest lever on how the UI "feels". */
  radius: { sm: number; md: number; lg: number };
  /** CSS font stacks. Keep a system stack unless you self-host the font. */
  font: { sans: string; display: string };
  contact: {
    /** A mailbox someone actually reads. */
    email: string;
    /** Digits only, no "+". Empty hides every WhatsApp button. */
    whatsapp: string;
    /** Handle without "@". Empty hides the link. */
    instagram: string;
    /**
     * Source repository, full URL. Empty hides every link to it.
     *
     * Goes here and not in the hub component because a fork renames the platform and
     * moves the code: one line changes, not a URL hunted through JSX.
     */
    repo: string;
  };
}

/**
 * What a country states differently about its brand, merged over `config/brand.ts`.
 *
 * Shallow-merged one level into the nested groups, so `colors: { brand: "#c0392b" }`
 * repaints links without restating the other ten colours.
 */
export interface BrandOverrides {
  platform?: string;
  name?: string;
  short?: string;
  tagline?: string;
  /** Path under /public, or `null` for the wordmark. State it: the base cannot guess. */
  logo?: string | null;
  emoji?: string;
  colors?: Partial<BrandColors>;
  radius?: Partial<BrandConfig["radius"]>;
  font?: Partial<BrandConfig["font"]>;
  contact?: Partial<BrandConfig["contact"]>;
}

// ---------------------------------------------------------------------------
// Language — how this deployment speaks
// ---------------------------------------------------------------------------

/**
 * Copy overrides, per language, keyed by dictionary key. This is how a clone renames
 * "refugio" to "albergue", or softens a warning, WITHOUT editing `src/i18n` and having
 * to resolve that file on every upstream merge.
 */
export type CopyOverrides = Partial<Record<Lang, Record<string, string>>>;

export interface LanguageConfig {
  /** The language this country reads first. */
  default: Lang;
  /** Offered in the language switcher. Always include `default`. */
  available: Lang[];
  overrides: CopyOverrides;
}

/**
 * A country's own language settings, merged over `config/language.ts`.
 *
 * `overrides` merges per language and per key, so a country renaming "refugio" to
 * "albergue" keeps every other override the base ships.
 */
export interface LanguageOverrides {
  default?: Lang;
  available?: Lang[];
  overrides?: CopyOverrides;
}

// ---------------------------------------------------------------------------
// Features — what this deployment offers
// ---------------------------------------------------------------------------

/**
 * Turn a feature on only when the data behind it exists. An empty list of people on a
 * map reads as "nothing happened here", which is worse than not offering it at all.
 */
export interface FeatureConfig {
  /** Needs card: what a point receives and needs right now. */
  needs: boolean;
  /** Public "suggest a point / register my initiative" form. */
  suggestions: boolean;
  /**
   * The `/inicio` entry page: the QR landing that asks "do you need help, or do you want
   * to help?" and routes from there. With it on, a first-time visitor to `/` is sent
   * there ONCE (see `proxy.ts`) and never again. Turn it off and `/` is the map for
   * everyone, and `/inicio` redirects there.
   */
  entryPage: boolean;
  /** Public form to join the team (admin-approved). */
  volunteerSignup: boolean;
  /**
   * Donations directory: organisations people can give money or goods to, plus the
   * "write to us" form an organisation uses to ask to be listed. Its empty state is a
   * call for organisations, not a failure, so it is worth switching on before the first
   * one exists — unlike a list of people.
   */
  donations: boolean;
  /** Read-only public JSON API + OpenAPI document. */
  publicApi: boolean;
  /** Keep the last successful load in the browser so the map opens without a network. */
  offline: boolean;
  /** Public list of admitted people. Needs a medical network. NOT implemented yet. */
  patients: boolean;
  /** Field "rescued but not yet transferred" list. Needs `patients`. NOT implemented yet. */
  rescued: boolean;
  /** Private missing-person lead form. NOT implemented yet. */
  missingReports: boolean;
}

// ---------------------------------------------------------------------------
// Map — how the map reads
// ---------------------------------------------------------------------------

export interface PointTypeStyle {
  /** Hide a type this country has no data for; it disappears from map, chips and forms. */
  enabled: boolean;
  /** Pin colour. Types must stay visually distinct from one another. */
  color: string;
  /** Key into the icon set (`src/ui/icons.tsx`). */
  icon: string;
  /** Sort order in chips and grouped selects. */
  order: number;
}

export interface MapConfig {
  tiles: {
    url: string;
    /** Required by every tile licence worth using. Never render the map without it. */
    attribution: string;
    /** Tile-server shards for the {s} placeholder. */
    subdomains?: string;
    maxZoom: number;
  };
  /** Per point type. Every LocationType must be present. */
  types: Record<LocationType, PointTypeStyle>;
  cluster: {
    enabled: boolean;
    /** Below this zoom, nearby pins of the same type collapse into one badge. */
    maxZoom: number;
  };
  /** Show the "my location" GPS button. */
  userLocation: boolean;
  /** Days without confirmation after which a point is flagged as possibly stale. */
  staleAfterDays: number;
}

// ---------------------------------------------------------------------------
// Hazard — the emergency this deployment is standing up for
// ---------------------------------------------------------------------------

/**
 * Seismic overlays, read live from the USGS earthquake service.
 *
 * Two layers, and the difference between them matters:
 *
 *   epicenters — WHERE it broke. One point per event, from the FDSN catalogue.
 *   intensity  — WHERE IT SHOOK, and therefore roughly where the damage is. These are
 *                USGS's own ShakeMap MMI contours, not a circle drawn around the
 *                epicentre: a deep or directional rupture shakes a shape, not a disc,
 *                and on this map that shape is the difference between the departamentos
 *                that need shelters and the ones that do not.
 *
 * Both are ESTIMATES published by USGS and they get revised — ShakeMap in particular is
 * automatic within minutes and reviewed later. The UI must keep saying so; a contour is
 * a modelled intensity, never a survey of standing buildings.
 */
export interface SeismicConfig {
  enabled: boolean;
  /** FDSN event web service. The public USGS instance needs no key and allows CORS. */
  api: string;
  /** Required by the USGS credit policy. Never render the layer without it. */
  attribution: string;
  /** Events weaker than this never reach the map — noise at country scale. */
  minMagnitude: number;
  /** How far back the catalogue query reaches. */
  windowDays: number;
  /** Hard cap on drawn events, strongest first. */
  maxEvents: number;
  /** Re-poll interval in minutes. 0 fetches once and stops. */
  refreshMinutes: number;
  /**
   * Search box as [[south, west], [north, east]]. `null` uses the country bounds, which
   * is what a clone normally wants: the shaking that matters is the shaking here.
   */
  bounds: [[number, number], [number, number]] | null;
  /**
   * Only events at or above this magnitude get their ShakeMap contours fetched. Each one
   * costs two extra requests and ~100 KB, and below roughly M6 the footprint is too small
   * to read at country zoom anyway.
   */
  contourMinMagnitude: number;
  /** Which layers start switched on. Both stay togglable either way. */
  defaultOn: { epicenters: boolean; intensity: boolean };
}

export interface HazardConfig {
  seismic: SeismicConfig;
}

/**
 * What a country reads differently about the seismic layers, merged over
 * `config/hazard.ts`.
 *
 * The thresholds in that file are tuned for a subduction margin: M4.5 and up, contours
 * from M6. Those numbers are not universal, and a shared file cannot hold two answers.
 *
 *   Spain      the Granada sequence of August 2026 tops out at M5.2, so `minMagnitude`
 *              4.5 keeps barely four events and `contourMinMagnitude` 6 draws NO
 *              intensity footprint at all — the deployment's whole reason for existing,
 *              blank, on a map standing up for that emergency.
 *   Indonesia  the opposite problem: 153 events of M4.5+ in fourteen days across the
 *              archipelago, well past `maxEvents`, so the cap silently truncates and the
 *              map becomes a curtain of dots 5.000 km wide.
 *
 * Shallow-merged into `seismic`, so a country states the one or two numbers it reads
 * differently and keeps following the base for the rest.
 */
export interface HazardOverrides {
  seismic?: Partial<SeismicConfig>;
}

// ---------------------------------------------------------------------------
// Integrations — what this deployment talks to
// ---------------------------------------------------------------------------

/** A partner feed this clone pulls points from (AcopioVE is the reference case). */
export interface ExternalFeed {
  id: string;
  label: string;
  /** Base URL of the partner API. */
  url: string;
  /** Shown wherever a row from this feed is displayed — usually a licence requirement. */
  attribution: string;
  enabled: boolean;
}

export interface IntegrationsConfig {
  analytics: {
    /** Cookieless Vercel Web Analytics. Never send names or search terms as events. */
    vercel: boolean;
    /**
     * Google Analytics 4 measurement id ("G-XXXXXXXX"). Empty → no gtag.js is loaded.
     * Read by the root layout, so it covers the entry page and the map alike.
     *
     * The same id is meant to be shared by every country deployment (`integrations` is not
     * overridable per country), landing them in one GA4 property; the layout sends
     * `country_code` on the `config` call so reports can still split by deployment. gtag
     * boots with Consent Mode `analytics_storage: 'denied'`, i.e. cookieless, until a
     * deployment's own consent banner (none today) grants it.
     *
     * Same rule as `vercel`: pageviews only, never custom events carrying names, documents
     * or search terms.
     */
    ga: string;
  };
  email: {
    /** Where the contact and suggestion forms deliver. Empty → forms store to DB only. */
    to: string;
    from: string;
  };
  feeds: ExternalFeed[];
  pwa: { enabled: boolean };
}

// ---------------------------------------------------------------------------
// Network — every deployment of HelpMaps (drives the hub map)
// ---------------------------------------------------------------------------

export interface Deployment {
  slug: string;
  /** Country name as displayed on the hub. */
  name: string;
  code: string;
  flag: string;
  /** Absolute URL of that country's app. */
  url: string;
  /** "live" is clickable; "preparing" shows as an outline pin and is not linked. */
  status: "live" | "preparing";
  /** Pin position on the hub map. */
  lat: number;
  lng: number;
  /** Optional one-liner shown in the hub card. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Deployment mode
// ---------------------------------------------------------------------------

/**
 * "country" — a national app (col.helpmaps.net): map, centres, needs, staff panel.
 * "hub"     — helpmaps.net itself: what HelpMaps is, where it runs, the public API
 *             documentation, the terms, and how to bring it to your country.
 *
 * Same codebase, two deploy targets. Set NEXT_PUBLIC_MODE=hub on the root domain.
 */
export type DeploymentMode = "country" | "hub";

// ---------------------------------------------------------------------------
// Assembled
// ---------------------------------------------------------------------------

export interface SiteConfig {
  mode: DeploymentMode;
  country: CountryConfig;
  brand: BrandConfig;
  language: LanguageConfig;
  features: FeatureConfig;
  map: MapConfig;
  hazard: HazardConfig;
  integrations: IntegrationsConfig;
  network: Deployment[];
}
