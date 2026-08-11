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

import type { BrandConfig } from "@/config/types";
import country from "~/config/country";

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

const brand: BrandConfig = {
  platform: PLATFORM,
  name: `${PLATFORM} ${country.name}`,
  short: `${PLATFORM} ${country.code}`,
  tagline: "Encuentra ayuda cerca de ti y muestra dónde hace falta.",

  // Ruta bajo `public/`. Ej.: pon el archivo en `public/colombia.png` y escribe
  // "/colombia.png". Si es `null` se muestra la inicial del país sobre el color de marca.
  logo: "/colombia.png",
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
  },
};

export default brand;
