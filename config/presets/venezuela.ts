import type { CountryConfig } from "@/config/types";

/**
 * Venezuela — ve.helpmaps.net
 *
 * The original deployment (helpmapvzla.net) still runs from its own repository. This
 * preset is its migration target, and it keeps the base honest: a second country in the
 * tree is what proves nothing under `src/` is hardcoded to the first one.
 */
const venezuela: CountryConfig = {
  slug: "ve",
  code: "VE",
  name: "Venezuela",
  host: "helpmapvzla.net",
  regionNoun: { one: "estado", many: "estados" },

  geo: {
    center: [10.3, -67.0],
    zoom: 8,
    regionZoom: 9,
    bounds: [
      [0.6, -73.4],
      [12.3, -59.8],
    ],
    geocodeCountry: "ve",
  },

  regions: [
    { code: "amazonas", name: "Amazonas", lat: 3.9, lng: -65.8 },
    { code: "anzoategui", name: "Anzoátegui", lat: 9.0, lng: -64.3 },
    { code: "apure", name: "Apure", lat: 7.0, lng: -68.5 },
    { code: "aragua", name: "Aragua", lat: 10.1, lng: -67.3 },
    { code: "barinas", name: "Barinas", lat: 8.3, lng: -70.0 },
    { code: "bolivar", name: "Bolívar", lat: 5.8, lng: -63.5 },
    { code: "carabobo", name: "Carabobo", lat: 10.2, lng: -68.1 },
    { code: "cojedes", name: "Cojedes", lat: 9.3, lng: -68.4 },
    { code: "delta_amacuro", name: "Delta Amacuro", lat: 9.0, lng: -61.3 },
    { code: "distrito_capital", name: "Distrito Capital", lat: 10.49, lng: -66.88, zoom: 12 },
    { code: "falcon", name: "Falcón", lat: 11.2, lng: -69.8 },
    { code: "guarico", name: "Guárico", lat: 8.9, lng: -66.4 },
    { code: "la_guaira", name: "La Guaira", lat: 10.6, lng: -66.9, zoom: 11 },
    { code: "lara", name: "Lara", lat: 10.1, lng: -69.8 },
    { code: "merida", name: "Mérida", lat: 8.5, lng: -71.2 },
    { code: "miranda", name: "Miranda", lat: 10.3, lng: -66.4 },
    { code: "monagas", name: "Monagas", lat: 9.4, lng: -63.2 },
    { code: "nueva_esparta", name: "Nueva Esparta", lat: 11.0, lng: -63.9 },
    { code: "portuguesa", name: "Portuguesa", lat: 9.1, lng: -69.3 },
    { code: "sucre", name: "Sucre", lat: 10.4, lng: -63.5 },
    { code: "tachira", name: "Táchira", lat: 7.8, lng: -72.2 },
    { code: "trujillo", name: "Trujillo", lat: 9.3, lng: -70.5 },
    { code: "yaracuy", name: "Yaracuy", lat: 10.3, lng: -68.8 },
    { code: "zulia", name: "Zulia", lat: 10.0, lng: -71.8 },
  ],

  legal: {
    controller: "HelpMaps Venezuela — Tropical Sadness x Imágenes Nacionales",
    privacyEmail: "info@helpmapvzla.net",
    dataLaw: "los artículos 28 y 60 de la Constitución y la LOPNNA (art. 65)",
    jurisdiction: "Venezuela",
  },

  // Venezuela against the shared kit. Stated even where it matches the base, because this
  // preset is what the migration from the original repo fills in — and an explicit `null`
  // reads as a decision, while an absent key reads as an oversight.
  //
  // No logo file yet: the wordmark renders the country initial over the brand colour.
  // Drop the asset in `public/` and point at it here when the migration brings it over.
  brand: {
    logo: "/Venezuela.png",
    contact: {
      email: "info@helpmapvzla.net",
      whatsapp: "",
      instagram: "",
    },
  },

  // "Refugio" — the base dictionary's word — is the one Venezuela uses, so there is no
  // vocabulary override here. Colombia is the country that renames it, to "Albergue".
  //
  // Lo que sí vive acá es el sustantivo de región EN INGLÉS. `country.regionNoun` es un
  // dato del país y tiene una sola forma, la del idioma en que se escribió el preset: con
  // la interfaz en inglés, el filtro decía "All estados". El nombre de la división no se
  // traduce solo —"departamento" no es "department"— así que lo declara quien conoce el
  // país, por idioma, con el mismo mecanismo que renombra cualquier otra palabra.
  language: {
    overrides: {
      en: {
        "map.allRegions": "All states",
        "map.regionOne": "State",
      },
    },
  },
};

export default venezuela;
