import type { CountryConfig } from "@/config/types";

/**
 * Indonesia — id.helpmaps.net
 *
 * A preset holds ONLY what is true about the country: identity, regions, viewport and
 * the law that applies. Look, language, features and integrations are separate files in
 * `config/` so a clone can adopt upstream changes to one without touching the others.
 *
 * IDIOMA: no hay diccionario en indonesio —`src/i18n/types.ts` solo admite "es" | "en" |
 * "pt"— y la decisión tomada es servir en inglés donde falte la lengua local, en vez de
 * retener el despliegue. Es una limitación real y conviene tenerla presente: en Flores el
 * inglés es segunda lengua y minoritaria, así que la localización pierde a parte de quien
 * busca refugio. Cuando se añada `src/i18n/dictionaries/id.ts` y el idioma "id" al tipo
 * `Lang` —trabajo del repo base, no de este archivo—, aquí solo cambian dos líneas.
 */
const indonesia: CountryConfig = {
  slug: "id",
  code: "ID",
  name: "Indonesia",

  // En inglés mientras la interfaz esté en inglés: la etiqueta de un filtro tiene que
  // estar en la lengua que se está leyendo. Con el diccionario en indonesio pasa a
  // "provinsi" / "provinsi".
  regionNoun: { one: "province", many: "provinces" },

  host: "id.helpmaps.net",

  geo: {
    // Abre sobre el SISMO: epicentro del M 7.7 del 2026-08-14 (21:58:21 UTC, 05:58 hora
    // de Flores del día 15), 68 km al NNO de Ende — USGS us6000tkt2, -8.3101 / 121.3517,
    // 10 km de profundidad, MMI máx. 7.9 (PAGER 8), alerta amarilla. Media hora después,
    // un M 6.1 al norte de la misma isla.
    //   https://earthquake.usgs.gov/earthquakes/eventpage/us6000tkt2/shakemap/intensity
    //
    // Un M 7.7 a 10 km bajo el mar de Flores es la peor combinación posible: es la misma
    // zona y casi la misma mecánica del terremoto de 1992, y la sacudida de MMI ≥ 7
    // cubre 184 × 65 km de costa norte de Flores. La huella de MMI ≥ 4 mide 593 × 440 km
    // y alcanza Nusa Tenggara Timur entera, el este de Sumbawa (Nusa Tenggara Barat) y
    // las islas Selayar de Sulawesi Selatan; Bali queda en el borde donde solo se sintió.
    //
    // Zoom 8 encuadra esa huella de MMI ≥ 4. Ojo con moverlo: el país mide 5.000 km de
    // este a oeste, así que un encuadre nacional no muestra ninguna emergencia, muestra
    // un archipiélago.
    center: [-8.3101, 121.3517],
    zoom: 8,
    regionZoom: 8,

    // Todo el archipiélago, de Sabang a Merauke. Limita el paneo y sesga el
    // geocodificador, y también es la caja con la que `config/hazard.ts` consulta a USGS.
    bounds: [
      [-11.3, 94.7],
      [6.3, 141.3],
    ],
    geocodeCountry: "id",
  },

  // Las 38 provincias vigentes, incluidas las cinco de Papúa creadas entre 2022 y 2023
  // (Papua Selatan, Papua Tengah, Papua Pegunungan, Papua Barat Daya). Una lista de 34
  // —la que devuelve casi cualquier conjunto de datos publicado antes de 2022— dejaría
  // sin filtro a la mitad de Papúa.
  //
  // El punto de cada provincia es su CAPITAL, no el centroide geométrico. En un país de
  // 17.000 islas el centroide de una provincia cae en el mar más veces de las que cae en
  // tierra: el de Maluku queda en medio del mar de Banda, y el de Yakarta, mar adentro
  // entre las islas Mil y la ciudad. Sacado de los límites administrativos de
  // OpenStreetMap.
  regions: [
    { code: "aceh", name: "Aceh", lat: 5.55, lng: 95.32 },
    { code: "bali", name: "Bali", lat: -8.67, lng: 115.22, zoom: 10 },
    { code: "banten", name: "Banten", lat: -6.12, lng: 106.15 },
    { code: "bengkulu", name: "Bengkulu", lat: -3.79, lng: 102.26 },
    { code: "gorontalo", name: "Gorontalo", lat: 0.54, lng: 123.06 },
    { code: "jakarta", name: "DKI Jakarta", lat: -6.18, lng: 106.83, zoom: 11 },
    { code: "jambi", name: "Jambi", lat: -1.63, lng: 103.61 },
    { code: "jawa_barat", name: "Jawa Barat", lat: -6.92, lng: 107.61 },
    { code: "jawa_tengah", name: "Jawa Tengah", lat: -6.99, lng: 110.42 },
    { code: "jawa_timur", name: "Jawa Timur", lat: -7.25, lng: 112.74 },
    { code: "kalimantan_barat", name: "Kalimantan Barat", lat: -0.02, lng: 109.34 },
    { code: "kalimantan_selatan", name: "Kalimantan Selatan", lat: -3.44, lng: 114.83 },
    { code: "kalimantan_tengah", name: "Kalimantan Tengah", lat: -2.21, lng: 113.92 },
    { code: "kalimantan_timur", name: "Kalimantan Timur", lat: -0.5, lng: 117.14 },
    { code: "kalimantan_utara", name: "Kalimantan Utara", lat: 2.84, lng: 117.36 },
    { code: "kep_bangka_belitung", name: "Kepulauan Bangka Belitung", lat: -2.12, lng: 106.11 },
    { code: "kep_riau", name: "Kepulauan Riau", lat: 0.92, lng: 104.45 },
    { code: "lampung", name: "Lampung", lat: -5.45, lng: 105.26 },
    { code: "maluku", name: "Maluku", lat: -3.7, lng: 128.18 },
    { code: "maluku_utara", name: "Maluku Utara", lat: 0.73, lng: 127.58 },
    { code: "nusa_tenggara_barat", name: "Nusa Tenggara Barat", lat: -8.58, lng: 116.11 },
    // La provincia del sismo. Kupang, la capital, está en Timor, a 500 km de Flores:
    // filtrar por NTT hoy debería llevar a la isla que se rompió, y por eso este punto
    // NO es la capital sino el centro de Flores, con el zoom bajado para abarcarla.
    { code: "nusa_tenggara_timur", name: "Nusa Tenggara Timur", lat: -8.66, lng: 121.4, zoom: 8 },
    { code: "papua", name: "Papua", lat: -2.54, lng: 140.7 },
    { code: "papua_barat", name: "Papua Barat", lat: -0.86, lng: 134.08 },
    { code: "papua_barat_daya", name: "Papua Barat Daya", lat: -0.86, lng: 131.25 },
    { code: "papua_pegunungan", name: "Papua Pegunungan", lat: -4.09, lng: 138.95 },
    { code: "papua_selatan", name: "Papua Selatan", lat: -8.49, lng: 140.4 },
    { code: "papua_tengah", name: "Papua Tengah", lat: -3.36, lng: 135.5 },
    { code: "riau", name: "Riau", lat: 0.53, lng: 101.45 },
    { code: "sulawesi_barat", name: "Sulawesi Barat", lat: -2.67, lng: 118.89 },
    { code: "sulawesi_selatan", name: "Sulawesi Selatan", lat: -5.13, lng: 119.41 },
    { code: "sulawesi_tengah", name: "Sulawesi Tengah", lat: -0.9, lng: 119.87 },
    { code: "sulawesi_tenggara", name: "Sulawesi Tenggara", lat: -3.99, lng: 122.52 },
    { code: "sulawesi_utara", name: "Sulawesi Utara", lat: 1.49, lng: 124.84 },
    { code: "sumatera_barat", name: "Sumatera Barat", lat: -0.92, lng: 100.36 },
    { code: "sumatera_selatan", name: "Sumatera Selatan", lat: -2.99, lng: 104.76 },
    { code: "sumatera_utara", name: "Sumatera Utara", lat: 3.59, lng: 98.67 },
    { code: "yogyakarta", name: "DI Yogyakarta", lat: -7.8, lng: 110.36, zoom: 10 },
  ],

  legal: {
    controller: "HelpMaps Indonesia",
    privacyEmail: "info@helpmaps.net",
    // UU No. 27/2022 (PDP), en vigor plena desde octubre de 2024.
    dataLaw: "Law No. 27 of 2022 on Personal Data Protection (UU PDP)",
    jurisdiction: "Indonesia",
  },

  // El problema contrario al de España: en catorce días USGS registra 153 sismos de
  // M 4.5+ dentro de estos límites, muy por encima de `maxEvents`, así que el umbral de
  // la red haría que el mapa recortara en silencio y se llenara de puntos de 5.000 km de
  // distancia que no cambian ninguna decisión aquí. Con M 5.0+ quedan unos 50, que caben
  // enteros bajo el tope. Los contornos siguen en M 6: el principal, su réplica de M 6.9
  // en Sumatera Utara y poco más.
  hazard: {
    seismic: {
      minMagnitude: 5,
    },
  },

  brand: {
    logo: null,
  },

  // Inglés, por la decisión de cabecera: sin diccionario local se sirve en inglés antes
  // que retener el despliegue. El castellano NO se ofrece en el selector — un indonesio
  // que caiga en él no sabría volver, y aquí no aporta a nadie.
  language: {
    default: "en",
    available: ["en"],
  },
};

export default indonesia;
