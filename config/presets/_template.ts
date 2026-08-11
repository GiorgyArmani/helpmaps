import type { CountryConfig } from "@/config/types";

/**
 * TEMPLATE — copy to `config/presets/<pais>.ts`, fill it in, import it from
 * `config/country.ts`. The ⚠️ items send people to physical places, so a wrong value
 * has a real-world cost; verify them on a real map before deploying.
 *
 * Then go through `config/brand.ts`, `config/language.ts`, `config/features.ts` and
 * `config/network.ts`. The full checklist is in `docs/clonar-un-pais.md`.
 */
const template: CountryConfig = {
  slug: "xx", // TODO short id — DB stamp, cache namespace, preset filename
  code: "XX", // TODO ISO 3166-1 alpha-2, uppercase
  name: "País", // TODO
  host: "xx.helpmaps.net", // TODO canonical hostname of this clone

  // TODO what a first-level division is called here. It labels every filter in the UI.
  regionNoun: { one: "departamento", many: "departamentos" },

  geo: {
    center: [0, 0], // ⚠️ TODO the first screen must show where you actually have data
    zoom: 6, // ⚠️ TODO
    regionZoom: 9,
    bounds: [
      [0, 0], // ⚠️ TODO [south, west]
      [0, 0], // ⚠️ TODO [north, east]
    ],
    geocodeCountry: "xx", // TODO ISO alpha-2 lowercased
  },

  // TODO every first-level division with an approximate centroid. These only move the
  // viewport when a region is filtered, so "approximate" is genuinely fine.
  regions: [
    // { code: "region_uno", name: "Región Uno", lat: 0, lng: 0 },
  ],

  legal: {
    controller: "HelpMaps País", // TODO the organisation that answers for this data
    privacyEmail: "privacidad@helpmaps.net", // TODO
    dataLaw: "TODO: la ley de protección de datos de este país",
    jurisdiction: "TODO",
  },
};

export default template;
