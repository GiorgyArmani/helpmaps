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

  // ── EL SISMO QUE ESTE DESPLIEGUE EXISTE PARA MOSTRAR ──────────────────────
  //
  // El terremoto de Venezuela de 2026 es el M7.5 del 24 de junio, 20 km al oeste de Catia
  // La Mar (USGS `us6000t7zp`), con un M7.2 el mismo día junto a San Felipe
  // (`us6000t7zc`) y una secuencia de réplicas que llega hasta agosto.
  //
  // Con los valores heredados de `config/hazard.ts` ese sismo era INVISIBLE, y por dos
  // motivos que se sumaban:
  //
  //   `windowDays: 14`     mira sólo las dos últimas semanas. El evento principal ocurrió
  //                        hace más de dos meses, así que no entraba en la consulta. El
  //                        mapa mostraba un M4.9 en Colombia y nada más.
  //   `minMagnitude: 4.5`  calibrado para un margen de subducción. Deja fuera las réplicas
  //                        M3.5–M4 que son casi toda la secuencia.
  //
  // El resultado era el peor posible: el panel ofrecía "Epicentros" y "Zona afectada", y
  // el mapa salía vacío. Eso se lee como que la aplicación está rota o, peor, como que
  // aquí no ha temblado.
  //
  // ── POR QUÉ 180 DÍAS Y NO MÁS ─────────────────────────────────────────────
  //
  // La ventana tiene que alcanzar al 24 de junio y no pasarse de `maxEvents` (60), porque
  // el corte es silencioso: trunca y el mapa queda a medias sin avisar. Medido contra
  // USGS sobre la caja de este país:
  //
  //     ventana   M3.5+   M4.5+
  //      90 d      38      22
  //     180 d      52      26     ← cabe
  //     240 d      64      32     ← pasa del tope
  //
  // 180 días con M3.5 deja 52 eventos y cubre el sismo hasta finales de diciembre de 2026.
  // Cuando esa fecha se acerque hay que subir la ventana Y `maxEvents` a la vez, o el
  // principal desaparece del mapa sin que nadie toque nada.
  //
  // `contourMinMagnitude` se queda en 6: el M7.5 lo pasa de sobra y tiene ShakeMap
  // publicado, que es lo que hace que la capa "Zona afectada" dibuje la huella real de
  // sacudida en vez de nada.
  hazard: {
    seismic: {
      minMagnitude: 3.5,
      windowDays: 180,

      // ── LA CAJA CON LA QUE SE LE PREGUNTA A USGS ──────────────────────────
      //
      // Sin esto, `usgs.ts` cae a la envolvente de los centroides de los estados, que ya
      // se ciñe mucho mejor que el encuadre del mapa pero todavía deja pasar tres sismos
      // colombianos: la envolvente baja hasta Amazonas (centroide en 3.9) y por ese
      // extremo sur entra el ramal andino de Colombia, que tiembla entre 6 y 7.6 — por
      // debajo de donde empieza a temblar de este lado (8.67).
      //
      // Un rectángulo derivado de la FORMA del país no puede separarlos, porque la
      // sismicidad no sigue fronteras. Éste no describe la silueta de Venezuela: describe
      // su CINTURÓN SÍSMICO — Boconó, San Sebastián, El Pilar, el límite entre las placas
      // Caribe y Suramericana, donde está prácticamente todo lo que tiembla aquí y donde
      // ocurrió el M7.5 del 24 de junio.
      //
      // Medido contra USGS, 180 días, M3.5+:
      //
      //     encuadre del país          30/30 del país,  22 de fuera
      //     envolvente de estados      30/30,            3 de fuera
      //     este cinturón              30/30,            0 de fuera
      //
      // El intercambio, dicho en voz alta: deja fuera el escudo guayanés —Amazonas y el
      // sur de Bolívar—, que es asísmico y ajeno a esta emergencia. Un sismo en el extremo
      // sur del país no aparecería.
      bounds: [
        [8, -72.5],
        [12, -61.5],
      ],
    },
  },
};

export default venezuela;
