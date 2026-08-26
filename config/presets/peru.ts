import type { CountryConfig } from "@/config/types";

/**
 * Perú — pe.helpmaps.net
 *
 * A preset holds ONLY what is true about the country: identity, regions, viewport and
 * the law that applies. Look, language, features and integrations are separate files in
 * `config/` so a clone can adopt upstream changes to one without touching the others.
 */
const peru: CountryConfig = {
  slug: "pe",
  code: "PE",
  name: "Perú",

  // Nada responde todavía en este nombre: hay que apuntar el DNS antes de anunciarlo.
  // Mientras tanto `config/network.ts` deja a Perú en `status: "preparing"`, que dibuja
  // el pin en el hub sin enlazarlo.
  host: "pe.helpmaps.net",

  // INDECI y el COEN escriben "región Ayacucho", "región Apurímac" en cada reporte de
  // emergencia, y los gobiernos regionales son quienes abren los albergues. "Departamento"
  // es igual de correcto —lo usa el INEI— pero la gente que llega a este mapa viene
  // leyendo partes de INDECI, no censos.
  regionNoun: { one: "región", many: "regiones" },

  geo: {
    // Abre sobre el SISMO, no sobre el país: epicentro del M 6.7 del 2026-08-20
    // (18:00:18 UTC, 13:00 hora local), 31 km al NO de Aniso, provincia de Parinacochas,
    // Ayacucho — USGS us6000tm81, -14.6414 / -73.5236, 99 km de profundidad,
    // MMI máx. 5.8 (alerta verde, PAGER verde).
    //   https://earthquake.usgs.gov/earthquakes/eventpage/us6000tm81/shakemap/intensity
    //
    // El zoom 8 encuadra la huella de intensidad de ese ShakeMap (lat -16.43→-12.81,
    // lon -75.38→-71.67; unos 400 km de lado), que es lo que decide dónde hacen falta
    // albergues. Con MMI ≥ 4.5 —lo que se siente fuerte y tumba cosas de los estantes—
    // la mancha cae sobre Ayacucho y Apurímac casi entera, muerde el norte de Arequipa
    // (La Unión, Condesuyos) y roza el oeste de Cusco; el temblor de 99 km de
    // profundidad reparte la sacudida en una mancha alargada NO-SE, no en un círculo
    // alrededor del epicentro. Quien entra aterriza mirando esas regiones en vez de
    // tener que buscarlas desde una vista nacional.
    //
    // Cuando la emergencia se mueva —otra réplica, otro sismo, la costa en vez de la
    // sierra— estas dos líneas son toda la edición.
    center: [-14.6414, -73.5236],
    zoom: 8,
    regionZoom: 9,

    // `bounds` se queda a escala nacional a propósito: limita el paneo y sesga el
    // geocodificador, y ninguna de las dos cosas debe encogerse a un evento. El borde
    // oeste entra en el mar hasta pasada la fosa peruana porque ahí es donde ocurre la
    // mayoría de los sismos que se sienten aquí — y `config/hazard.ts` consulta a USGS
    // con esta misma caja (`seismic.bounds: null`), así que un epicentro frente a la
    // costa que quede fuera de estos límites no se dibujaría.
    bounds: [
      [-18.9, -82.2],
      [0.3, -68.3],
    ],
    geocodeCountry: "pe",
  },

  // Los 24 departamentos + la Provincia Constitucional del Callao. Los centroides son
  // aproximados a propósito: solo mueven el encuadre cuando se filtra una región, nunca
  // colocan un pin. Calculados sobre los polígonos departamentales del INEI.
  regions: [
    { code: "amazonas", name: "Amazonas", lat: -5.07, lng: -78.05 },
    { code: "ancash", name: "Áncash", lat: -9.41, lng: -77.67 },
    { code: "apurimac", name: "Apurímac", lat: -14.03, lng: -72.97 },
    { code: "arequipa", name: "Arequipa", lat: -15.84, lng: -72.48 },
    { code: "ayacucho", name: "Ayacucho", lat: -14.09, lng: -74.09 },
    { code: "cajamarca", name: "Cajamarca", lat: -6.43, lng: -78.74 },
    { code: "callao", name: "Callao", lat: -11.99, lng: -77.11, zoom: 11 },
    { code: "cusco", name: "Cusco", lat: -13.19, lng: -72.17 },
    { code: "huancavelica", name: "Huancavelica", lat: -13.03, lng: -75.0 },
    { code: "huanuco", name: "Huánuco", lat: -9.42, lng: -76.03 },
    { code: "ica", name: "Ica", lat: -14.23, lng: -75.58 },
    { code: "junin", name: "Junín", lat: -11.54, lng: -74.88 },
    { code: "la_libertad", name: "La Libertad", lat: -7.92, lng: -78.37 },
    { code: "lambayeque", name: "Lambayeque", lat: -6.35, lng: -79.82 },
    // El centroide geométrico de Lima cae en la sierra de Yauyos, a 100 km de donde vive
    // un tercio del país. Corrido hacia Lima Metropolitana con un zoom más cerrado:
    // filtrar "Lima" tiene que enseñar la ciudad, no el punto medio del polígono.
    { code: "lima", name: "Lima", lat: -11.95, lng: -76.9, zoom: 9 },
    { code: "loreto", name: "Loreto", lat: -4.12, lng: -74.43 },
    { code: "madre_de_dios", name: "Madre de Dios", lat: -11.98, lng: -70.53 },
    { code: "moquegua", name: "Moquegua", lat: -16.86, lng: -70.84 },
    { code: "pasco", name: "Pasco", lat: -10.4, lng: -75.3 },
    { code: "piura", name: "Piura", lat: -5.13, lng: -80.34 },
    { code: "puno", name: "Puno", lat: -14.93, lng: -69.95 },
    { code: "san_martin", name: "San Martín", lat: -7.04, lng: -76.72 },
    { code: "tacna", name: "Tacna", lat: -17.65, lng: -70.28 },
    { code: "tumbes", name: "Tumbes", lat: -3.86, lng: -80.54 },
    { code: "ucayali", name: "Ucayali", lat: -9.62, lng: -73.44 },
  ],

  legal: {
    controller: "HelpMaps Perú",
    privacyEmail: "info@helpmaps.net",
    // Ley 29733 y su reglamento nuevo, el D.S. 016-2024-JUS, vigente desde el 30 de
    // marzo de 2025 (sustituyó al D.S. 003-2013-JUS). Fiscaliza la Autoridad Nacional
    // de Protección de Datos Personales, del Ministerio de Justicia.
    dataLaw:
      "la Ley N.º 29733 de Protección de Datos Personales y su reglamento (D.S. 016-2024-JUS)",
    jurisdiction: "Perú",
  },

  // Lo que Perú hace distinto del kit compartido. Todo lo omitido sigue a
  // `config/brand.ts`, `config/features.ts` y `config/language.ts`, y lo sigue cuando la
  // base mejore.
  //
  // Sin archivo de logo todavía: el wordmark dibuja la inicial del país sobre el color
  // de marca. Cuando exista, va en `public/` y la ruta se escribe aquí — un recurso de
  // un país pertenece al preset de ese país, no a `config/brand.ts`, que lo enviaría a
  // todos los despliegues.
  brand: {
    logo: null,
  },

  // El diccionario base dice "Refugio", que es la palabra de Venezuela. En Perú, INDECI,
  // los gobiernos regionales y la prensa dicen "albergue" —"albergues temporales"— y el
  // sentido de este mapa es ser buscable con las palabras que la gente usa cuando está
  // buscando uno.
  //
  // "Punto de acopio" y "comedor" se dejan como están: son las palabras peruanas. Una
  // olla común se registra como comedor.
  language: {
    overrides: {
      es: {
        "type.shelter": "Albergue",
        "type.shelter.plural": "Albergues",
      },
    },
  },
};

export default peru;
