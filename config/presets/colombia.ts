import type { CountryConfig } from "@/config/types";

/**
 * Colombia — co.helpmaps.net
 *
 * A preset holds ONLY what is true about the country: identity, regions, viewport and
 * the law that applies. Look, language, features and integrations are separate files in
 * `config/` so a clone can adopt upstream changes to one without touching the others.
 */
const colombia: CountryConfig = {
  slug: "co",
  code: "CO",
  name: "Colombia",
  host: "co.helpmaps.net",
  regionNoun: { one: "departamento", many: "departamentos" },

  geo: {
    // Opens on the DISASTER, not on the country: the epicentre of the M 7.4 of
    // 2026-08-10 (12:34 UTC), 5 km S of San José del Palmar, Chocó — USGS us6000tjl2,
    // 4.8436 / -76.2422, depth 110 km, max MMI 7.9 (alert orange).
    //   https://earthquake.usgs.gov/earthquakes/eventpage/us6000tjl2/shakemap/intensity
    // Zoom 8 is chosen to frame that ShakeMap's intensity footprint (lat 3.74→6.00,
    // lon -77.45→-75.18, roughly 250 km a side): a visitor lands looking at the shaken
    // departamentos — Chocó, Risaralda, Quindío, Valle del Cauca, Caldas — instead of
    // having to find them from a national view. `bounds` below stays country-wide on
    // purpose: it limits panning and biases geocoding, and neither should shrink to
    // one event. When the emergency moves, these two lines are the whole edit.
    center: [4.8436, -76.2422],
    zoom: 8,
    regionZoom: 9,
    bounds: [
      [-4.23, -81.85],
      [13.5, -66.85],
    ],
    geocodeCountry: "co",
  },

  // The 32 departamentos + Bogotá D.C. Centroids are approximate on purpose: they only
  // move the viewport when a departamento is filtered, they never place a pin.
  regions: [
    { code: "amazonas", name: "Amazonas", lat: -1.2, lng: -71.6 },
    { code: "antioquia", name: "Antioquia", lat: 6.9, lng: -75.5 },
    { code: "arauca", name: "Arauca", lat: 6.55, lng: -70.95 },
    { code: "atlantico", name: "Atlántico", lat: 10.75, lng: -74.9 },
    { code: "bogota_dc", name: "Bogotá D.C.", lat: 4.65, lng: -74.1, zoom: 11 },
    { code: "bolivar", name: "Bolívar", lat: 8.75, lng: -74.4 },
    { code: "boyaca", name: "Boyacá", lat: 5.75, lng: -73.1 },
    { code: "caldas", name: "Caldas", lat: 5.3, lng: -75.3 },
    { code: "caqueta", name: "Caquetá", lat: 0.8, lng: -74.3 },
    { code: "casanare", name: "Casanare", lat: 5.4, lng: -71.6 },
    { code: "cauca", name: "Cauca", lat: 2.5, lng: -76.8 },
    { code: "cesar", name: "Cesar", lat: 9.5, lng: -73.5 },
    { code: "choco", name: "Chocó", lat: 5.7, lng: -76.65 },
    { code: "cordoba", name: "Córdoba", lat: 8.35, lng: -75.8 },
    { code: "cundinamarca", name: "Cundinamarca", lat: 4.8, lng: -74.3 },
    { code: "guainia", name: "Guainía", lat: 2.6, lng: -68.8 },
    { code: "guaviare", name: "Guaviare", lat: 2.05, lng: -72.3 },
    { code: "huila", name: "Huila", lat: 2.55, lng: -75.5 },
    { code: "la_guajira", name: "La Guajira", lat: 11.35, lng: -72.55 },
    { code: "magdalena", name: "Magdalena", lat: 10.2, lng: -74.3 },
    { code: "meta", name: "Meta", lat: 3.5, lng: -73.1 },
    { code: "narino", name: "Nariño", lat: 1.55, lng: -77.6 },
    { code: "norte_de_santander", name: "Norte de Santander", lat: 7.95, lng: -72.9 },
    { code: "putumayo", name: "Putumayo", lat: 0.7, lng: -76.3 },
    { code: "quindio", name: "Quindío", lat: 4.45, lng: -75.7, zoom: 10 },
    { code: "risaralda", name: "Risaralda", lat: 5.1, lng: -75.9 },
    { code: "san_andres", name: "San Andrés y Providencia", lat: 12.55, lng: -81.72, zoom: 10 },
    { code: "santander", name: "Santander", lat: 6.9, lng: -73.4 },
    { code: "sucre", name: "Sucre", lat: 9.1, lng: -75.1 },
    { code: "tolima", name: "Tolima", lat: 4.1, lng: -75.2 },
    { code: "valle_del_cauca", name: "Valle del Cauca", lat: 3.8, lng: -76.4 },
    { code: "vaupes", name: "Vaupés", lat: 0.7, lng: -70.6 },
    { code: "vichada", name: "Vichada", lat: 4.9, lng: -69.5 },
  ],

  legal: {
    controller: "HelpMaps Colombia",
    privacyEmail: "info@helpmaps.net",
    // Habeas data: what anyone handling personal data in Colombia answers to.
    dataLaw: "la Ley Estatutaria 1581 de 2012 y el Decreto 1377 de 2013 (habeas data)",
    jurisdiction: "Colombia",
  },

  // What Colombia does differently from the shared kit. Everything omitted follows
  // `config/brand.ts` and keeps following it when the base changes.
  //
  // This logo used to live in `config/brand.ts`, which meant every clone shipped
  // Colombia's mark: deploying the same repo with NEXT_PUBLIC_COUNTRY=ve produced
  // "HelpMaps Venezuela" wearing it. A country's asset belongs to that country's preset.
  brand: {
    logo: "/colombia.png",
  },

  // The base dictionary says "Refugio", which is the word Venezuela uses. Every Colombian
  // source covering the August 2026 quake — alcaldías, gobernaciones, Cruz Roja, the
  // press — says "albergue", and the point of this map is to be searchable in the words
  // people actually use when they are looking for one.
  language: {
    overrides: {
      es: {
        "type.shelter": "Albergue",
        "type.shelter.plural": "Albergues",
      },
    },
  },

  // ── EL SISMO QUE ESTE DESPLIEGUE EXISTE PARA MOSTRAR ──────────────────────
  //
  // El M7.4 del 10 de agosto de 2026, 5 km al sur de San José del Palmar, Chocó
  // (USGS `us6000tjl2`), a 110 km de profundidad, con MMI máxima 7.9 y alerta naranja.
  //
  // Con los valores heredados de `config/hazard.ts` ese sismo era INVISIBLE, y no por
  // un fallo sino por una ventana pensada para otra cosa:
  //
  //   windowDays: 14   mira sólo las dos últimas semanas. El evento es del 10 de agosto,
  //                    así que se salió de la ventana el 24 y el mapa se quedó sin un
  //                    solo epicentro. Y sin epicentros no hay evento principal; sin
  //                    evento principal `useQuakes.ts:96` no pide los contornos, así que
  //                    "Zona afectada" tampoco dibujaba nada. El panel ofrecía las dos
  //                    capas y las dos salían vacías, que se lee como que la aplicación
  //                    está rota o —peor— como que aquí no ha temblado.
  //
  // ── POR QUÉ 180 DÍAS ──────────────────────────────────────────────────────
  //
  // Basta con 18 para alcanzar al 10 de agosto, pero una ventana justa caduca sola: hay
  // que elegirla por cuánto tiempo aguanta. 180 días mantienen el sismo en el mapa hasta
  // el 6 DE FEBRERO DE 2027, y esa fecha está escrita para que se pueda buscar.
  //
  // El tope de `maxEvents` (60) no amenaza al principal, al contrario de lo que sugiere
  // la nota de Venezuela: `usgs.ts` consulta con `orderby: "magnitude"` y recorta con
  // `sort(byImpact).slice(...)`, así que lo que se pierde por arriba son los eventos
  // PEQUEÑOS, nunca el mayor. Una ventana amplia degrada la nube de réplicas, no el
  // sismo que importa.
  //
  // ── LO QUE FALTA MEDIR, Y NO ME LO INVENTO ────────────────────────────────
  //
  // `minMagnitude` se queda en el 4.5 heredado y `bounds` en null a propósito. Los dos
  // son sospechosos y ninguno es evidente:
  //
  //   minMagnitude   Venezuela bajó a 3.5 porque sus réplicas estaban entre 3.5 y 4. Este
  //                  sismo fue a 110 km de profundidad y un evento intermedio produce
  //                  muchas menos réplicas que uno superficial: bajarlo puede no añadir
  //                  nada, o puede inundar el mapa. Hay que contarlo antes.
  //
  //   bounds         Al ser null cae a `geo.bounds`, que es el encuadre del mapa y va de
  //                  -4.23 a 13.5 de latitud: mete dentro el norte de Ecuador, el sur de
  //                  Panamá y la frontera con Perú. Y con `orderby: magnitude` eso duele
  //                  MÁS que en Venezuela — un evento fuerte ecuatoriano entra por
  //                  delante de las réplicas colombianas, no por detrás.
  //
  //                  Tampoco es un rectángulo fácil: la subducción del Pacífico frente a
  //                  Nariño y Cauca está mar afuera, y el nido de Bucaramanga está a 600
  //                  km de allí. Una caja que cubra las dos cubre medio Ecuador.
  //
  // Las consultas para medirlo están en `db/02_emergencia.co.sql`. Cuando haya números,
  // van aquí Y en esa fila, con la tabla al lado.
  hazard: {
    seismic: {
      windowDays: 180,
    },
  },
};

export default colombia;
