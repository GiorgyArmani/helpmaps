// ── CÓMO SE VE Y A QUIÉN SE LE ESCRIBE ──────────────────────────────────────
//
// Este archivo es el 90% de lo que hace que un clon se sienta propio. Los valores por
// defecto se derivan del país (`HelpMaps Colombia`) para que una clonación funcione sin
// tocar nada, pero lo normal es personalizarlo.
//
// Los colores salen de aquí a CSS como custom properties (`src/ui/theme.ts`) y NINGUNA
// hoja de estilos escribe un color literal: cambiar `brand` repinta enlaces y acentos,
// cambiar `accent` repinta chips activos, botones primarios y el pin seleccionado.
//
// ⚠️ El cromo es casi negro a propósito. En este mapa el color pertenece a los PUNTOS
// (cada tipo tiene el suyo, en `config/map.ts`); si la interfaz compite con ellos, los
// pines se leen peor. Si pones un `accent` de color, revisa el mapa antes de quedártelo.
//
// ── QUÉ ES DE LA RED Y QUÉ ES DE UN PAÍS ────────────────────────────────────
//
// Lo de abajo es la marca COMPARTIDA: lo que se ve igual en todos los despliegues. Lo
// que un país hace distinto se declara en SU preset (`config/presets/<pais>.ts` → `brand`)
// y se funde encima aquí.
//
// El reparto importa. `logo` vivía aquí con el valor "/colombia.png", así que desplegar
// este repo con NEXT_PUBLIC_COUNTRY=ve daba "HelpMaps Venezuela" con el logo de Colombia:
// un archivo compartido con el valor de un país dentro. Todo lo que sea de UN país va en
// su preset; aquí solo queda lo que la red comparte.

import type { BrandConfig, BrandOverrides } from "@/config/types";
import country from "~/config/country";
import mode from "~/config/deployment";

/**
 * El nombre de la PLATAFORMA, no el de este despliegue.
 *
 * "HelpMaps" es el proyecto del que cada clon es una instancia; `name` de abajo es este
 * despliegue en concreto ("HelpMaps Colombia"). La documentación habla casi siempre de
 * la plataforma —"desplegar HelpMaps en tu país", "la API pública de HelpMaps"— y por
 * eso sale de aquí: si haces un fork con otro nombre, cambias esta línea y no veinte
 * archivos de texto.
 */
const PLATFORM = "HelpMaps";

const base: BrandConfig = {
  platform: PLATFORM,
  name: `${PLATFORM} ${country.name}`,
  short: `${PLATFORM} ${country.code}`,
  tagline: "Encuentra ayuda cerca de ti y muestra dónde hace falta.",

  // `null` = la inicial del país sobre el color de marca. Es el valor compartido correcto:
  // la red no tiene un logo, cada país tiene el suyo. Para poner uno, deja el archivo en
  // `public/` y escribe la ruta en el preset de ese país:
  //   brand: { logo: "/colombia.png" }
  logo: null,
  // Se usa como icono de la PWA y de la pestaña cuando no hay logo.
  emoji: "",

  colors: {
    ink: "#16191f",
    muted: "#7b818c",
    line: "#ebecef",
    soft: "#f7f8f9",
    soft2: "#eef0f2",
    accent: "#15181d",
    brand: "#1d4ed8",
    ok: "oklch(0.66 0.11 155)",
    info: "oklch(0.62 0.13 250)",
    neutral: "oklch(0.52 0.03 280)",
    danger: "oklch(0.6 0.16 26)",
  },

  radius: { sm: 9, md: 12, lg: 18 },

  font: {
    sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    display: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },

  contact: {
    email: country.legal.privacyEmail,
    // Solo dígitos, sin "+". Vacío esconde todos los botones de WhatsApp.
    whatsapp: "",
    // Sin "@". Vacío esconde el enlace.
    instagram: "",
    // El código. Compartido por toda la red: un país no tiene repositorio propio, y un
    // fork que se lleve la plataforma cambia esta línea y nada más.
    repo: "https://github.com/GiorgyArmani/helpmaps",
  },
};

/**
 * La marca del HUB (helpmaps.net). No es la de ningún país: es la de la plataforma.
 *
 * Existe porque el hub no tiene país y aun así `country` resuelve a DEFAULT_COUNTRY para
 * que todo lo demás funcione. Sin este bloque el hub heredaba los overrides de ese país y
 * se presentaba como "HelpMaps Colombia", con el logo de Colombia, en helpmaps.net — el
 * mismo fallo que hacía que su sitemap dijera co.helpmaps.net.
 *
 * El logo es la cruz de HelpMaps: la marca común, sin bandera de nadie.
 */
const HUB: BrandOverrides = {
  name: PLATFORM,
  short: PLATFORM,
  logo: "/general.png",
};

// En modo hub se ignoran a propósito los overrides del país por defecto: el hub no es un
// despliegue de ese país, solo comparte su preset para resolver idioma y encuadre.
//
// Fusión de un nivel dentro de cada grupo anidado: `colors: { brand: "#c0392b" }` repinta
// los enlaces sin obligar al preset a repetir los otros diez colores.
const o: BrandOverrides = mode === "hub" ? HUB : country.brand ?? {};

const brand: BrandConfig = {
  ...base,
  ...o,
  colors: { ...base.colors, ...o.colors },
  radius: { ...base.radius, ...o.radius },
  font: { ...base.font, ...o.font },
  contact: { ...base.contact, ...o.contact },
};

export default brand;
