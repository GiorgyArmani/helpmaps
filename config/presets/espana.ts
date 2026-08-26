import type { CountryConfig } from "@/config/types";

/**
 * España — es.helpmaps.net
 *
 * A preset holds ONLY what is true about the country: identity, regions, viewport and
 * the law that applies. Look, language, features and integrations are separate files in
 * `config/` so a clone can adopt upstream changes to one without touching the others.
 */
const espana: CountryConfig = {
  slug: "es",
  code: "ES",
  name: "España",
  host: "es.helpmaps.net",
  regionNoun: { one: "provincia", many: "provincias" },

  geo: {
    // Abre sobre el SISMO: epicentro del M 5.2 del 2026-08-14 (23:04:40 UTC, 01:04 hora
    // peninsular del día 15), 1 km al SO de Otura, Vega de Granada — USGS us6000tkv2,
    // 37.0789 / -3.6486, 10 km de profundidad, MMI máx. 7.0, alerta amarilla, 126
    // testimonios "lo sentí".
    //   https://earthquake.usgs.gov/earthquakes/eventpage/us6000tkv2/shakemap/intensity
    //
    // No es un evento aislado sino una SERIE en la misma cuenca, todavía activa: M 4.9
    // (Granada, día 18), M 4.7 (Alhendín) y M 4.6 (Escúzar) en cuestión de dos horas esa
    // mañana. Un enjambre somero de magnitud moderada bajo una ciudad de 230.000
    // habitantes hace más daño que un sismo mayor a 100 km de profundidad, y por eso
    // este despliegue existe.
    //
    // El zoom 10 —no 8 como en los despliegues andinos— es consecuencia directa de esos
    // 10 km de profundidad: la huella de MMI ≥ 4 mide 50 × 53 km y la de MMI ≥ 5 solo
    // 23 × 26 km. A escala de país no se distinguiría nada; así se encuadra la Vega
    // entera con la ciudad de Granada dentro, que está a 11 km al norte del epicentro.
    center: [37.0789, -3.6486],
    zoom: 10,
    regionZoom: 9,

    // Península, Baleares, Canarias, Ceuta y Melilla. La caja es enorme y casi toda
    // Atlántico porque tiene que contener los centroides de Las Palmas y Santa Cruz de
    // Tenerife —`src/config/validate.ts` falla el build si una provincia cae fuera— y
    // porque el archipiélago canario tiene su propia sismicidad, volcánica, que este
    // mismo mapa debe poder cubrir sin cambiar de despliegue.
    bounds: [
      [27.4, -18.4],
      [44.0, 4.5],
    ],
    geocodeCountry: "es",
  },

  // Las 50 provincias + Ceuta y Melilla. El punto de cada una es su CAPITAL, no el
  // centroide geométrico: solo mueven el encuadre al filtrar, y la capital es donde está
  // la gente. Tomadas de los límites administrativos de OpenStreetMap.
  //
  // Los nombres van en la forma castellana por ser esta la lengua del despliegue; varias
  // tienen además nombre oficial cooficial (A Coruña, Girona, Lleida, Gipuzkoa, Bizkaia,
  // Araba, Illes Balears). Si este despliegue se abre a esas lenguas, el sitio de esos
  // nombres es `language.overrides`, no este archivo.
  regions: [
    { code: "alava", name: "Álava", lat: 42.85, lng: -2.67 },
    { code: "albacete", name: "Albacete", lat: 39.0, lng: -1.86 },
    { code: "alicante", name: "Alicante", lat: 38.34, lng: -0.49 },
    { code: "almeria", name: "Almería", lat: 36.84, lng: -2.46 },
    { code: "asturias", name: "Asturias", lat: 43.36, lng: -5.85 },
    { code: "avila", name: "Ávila", lat: 40.66, lng: -4.7 },
    { code: "badajoz", name: "Badajoz", lat: 38.88, lng: -6.97 },
    { code: "baleares", name: "Islas Baleares", lat: 39.57, lng: 2.65 },
    { code: "barcelona", name: "Barcelona", lat: 41.38, lng: 2.18, zoom: 10 },
    { code: "burgos", name: "Burgos", lat: 42.34, lng: -3.7 },
    { code: "caceres", name: "Cáceres", lat: 39.47, lng: -6.37 },
    { code: "cadiz", name: "Cádiz", lat: 36.53, lng: -6.29 },
    { code: "cantabria", name: "Cantabria", lat: 43.46, lng: -3.81 },
    { code: "castellon", name: "Castellón", lat: 39.99, lng: -0.04 },
    { code: "ceuta", name: "Ceuta", lat: 35.89, lng: -5.32, zoom: 12 },
    { code: "ciudad_real", name: "Ciudad Real", lat: 38.99, lng: -3.93 },
    { code: "cordoba", name: "Córdoba", lat: 37.88, lng: -4.78 },
    { code: "cuenca", name: "Cuenca", lat: 40.07, lng: -2.13 },
    { code: "girona", name: "Girona", lat: 41.98, lng: 2.82 },
    { code: "granada", name: "Granada", lat: 37.17, lng: -3.6 },
    { code: "guadalajara", name: "Guadalajara", lat: 40.63, lng: -3.16 },
    { code: "guipuzcoa", name: "Guipúzcoa", lat: 43.32, lng: -1.98 },
    { code: "huelva", name: "Huelva", lat: 37.26, lng: -6.95 },
    { code: "huesca", name: "Huesca", lat: 42.14, lng: -0.41 },
    { code: "jaen", name: "Jaén", lat: 37.77, lng: -3.79 },
    { code: "la_coruna", name: "A Coruña", lat: 43.37, lng: -8.4 },
    { code: "la_rioja", name: "La Rioja", lat: 42.47, lng: -2.44 },
    { code: "las_palmas", name: "Las Palmas", lat: 28.13, lng: -15.43 },
    { code: "leon", name: "León", lat: 42.6, lng: -5.57 },
    { code: "lleida", name: "Lleida", lat: 41.61, lng: 0.63 },
    { code: "lugo", name: "Lugo", lat: 43.01, lng: -7.56 },
    { code: "madrid", name: "Madrid", lat: 40.42, lng: -3.7, zoom: 10 },
    { code: "malaga", name: "Málaga", lat: 36.72, lng: -4.42 },
    { code: "melilla", name: "Melilla", lat: 35.29, lng: -2.94, zoom: 12 },
    { code: "murcia", name: "Murcia", lat: 37.99, lng: -1.13 },
    { code: "navarra", name: "Navarra", lat: 42.82, lng: -1.64 },
    { code: "ourense", name: "Ourense", lat: 42.34, lng: -7.87 },
    { code: "palencia", name: "Palencia", lat: 42.01, lng: -4.53 },
    { code: "pontevedra", name: "Pontevedra", lat: 42.43, lng: -8.64 },
    { code: "salamanca", name: "Salamanca", lat: 40.97, lng: -5.66 },
    { code: "santa_cruz_de_tenerife", name: "Santa Cruz de Tenerife", lat: 28.47, lng: -16.25 },
    { code: "segovia", name: "Segovia", lat: 40.95, lng: -4.12 },
    { code: "sevilla", name: "Sevilla", lat: 37.39, lng: -6.0 },
    { code: "soria", name: "Soria", lat: 41.76, lng: -2.46 },
    { code: "tarragona", name: "Tarragona", lat: 41.12, lng: 1.25 },
    { code: "teruel", name: "Teruel", lat: 40.34, lng: -1.11 },
    { code: "toledo", name: "Toledo", lat: 39.86, lng: -4.02 },
    { code: "valencia", name: "Valencia", lat: 39.47, lng: -0.38 },
    { code: "valladolid", name: "Valladolid", lat: 41.65, lng: -4.73 },
    { code: "vizcaya", name: "Vizcaya", lat: 43.26, lng: -2.94 },
    { code: "zamora", name: "Zamora", lat: 41.51, lng: -5.74 },
    { code: "zaragoza", name: "Zaragoza", lat: 41.65, lng: -0.88 },
  ],

  legal: {
    controller: "HelpMaps España",
    privacyEmail: "info@helpmaps.net",
    dataLaw:
      "el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales",
    jurisdiction: "España",
  },

  // ⚠️ Los umbrales de la red están afinados para la subducción andina y dejarían este
  // despliegue MUDO: con `minMagnitude: 4.5` la serie de Granada aporta cuatro puntos, y
  // con `contourMinMagnitude: 6` el M 5.2 —que sí tiene ShakeMap publicado— no dibujaría
  // ningún contorno, así que la capa de "zona afectada", que arranca encendida, saldría
  // vacía. Bajar a 4.5 el umbral de contornos es lo que hace que este mapa enseñe la
  // mancha de intensidad que justifica su existencia.
  //
  // Aviso sobre la fuente: el catálogo autoritativo en España es el del IGN, no el de
  // USGS. USGS solo recoge parte de los sismos pequeños peninsulares —de esta serie
  // tiene cuatro—, así que este mapa muestra MENOS temblores de los que el IGN publica.
  // Es una limitación de leer un servicio global; cambiar la fuente al IGN es trabajo
  // del repo base, no de este preset.
  hazard: {
    seismic: {
      minMagnitude: 3,
      contourMinMagnitude: 4.5,
    },
  },

  brand: {
    logo: null,
  },

  // Vocabulario de España, que no es el de América. "Punto de acopio" es la forma
  // latinoamericana; aquí se dice "punto de recogida", y un "comedor" es un "comedor
  // social". La palabra que la gente teclea cuando busca ayuda vale más que cualquier
  // rediseño, y estas tres son las que se teclean aquí.
  language: {
    overrides: {
      es: {
        "type.shelter": "Albergue",
        "type.shelter.plural": "Albergues",
        "type.donation_centre": "Punto de recogida",
        "type.donation_centre.plural": "Puntos de recogida",
        "type.comedor": "Comedor social",
        "type.comedor.plural": "Comedores sociales",
      },
    },
  },
};

export default espana;
