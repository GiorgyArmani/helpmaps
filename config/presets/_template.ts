import type { CountryConfig } from "@/config/types";

/**
 * TEMPLATE — copy to `config/presets/<pais>.ts`, fill it in, import it from
 * `config/country.ts`. The ⚠️ items send people to physical places, so a wrong value
 * has a real-world cost; verify them on a real map before deploying.
 *
 * This file is the WHOLE country. Adding one to the base repo — plus its own Supabase
 * project and `NEXT_PUBLIC_COUNTRY` — is a full deployment: no fork, and every upstream
 * fix arrives without a merge.
 *
 * The `brand`, `features` and `language` blocks at the bottom state only what this
 * country does differently from the shared kit (`config/brand.ts`, `config/features.ts`,
 * `config/language.ts`). Leave out what matches; what you leave out keeps following the
 * base as it improves.
 *
 * Every `TODO` below fails the build until you replace it — `src/config/validate.ts`
 * walks this object looking for them, along with bounds that don't contain the map
 * centre and region codes that repeat. Then add the country to `config/network.ts`.
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

  // ── Lo que este país hace distinto ────────────────────────────────────────
  // Todo lo de aquí abajo es OPCIONAL. Borra los bloques que no uses: lo omitido sigue
  // al kit compartido, y lo sigue cuando la base mejore.

  brand: {
    // Deja el archivo en `public/` y escribe la ruta. `null` = la inicial del país sobre
    // el color de marca, que es un valor por defecto digno mientras no haya logo.
    logo: null,
    // colors: { brand: "#1d4ed8" },   // enlaces y acentos. Revisa el mapa después.
    // contact: { whatsapp: "", instagram: "" },
  },

  // features: { donations: false },   // apaga lo que este país todavía no puede llenar

  // El vocabulario que la gente usa aquí vale más que cualquier rediseño. Se pisa clave
  // por clave sobre `src/i18n/dictionaries/`, así que sobrevive a los merges del repo base.
  // language: {
  //   overrides: { es: { "type.shelter": "Albergue", "type.shelter.plural": "Albergues" } },
  // },
};

export default template;
