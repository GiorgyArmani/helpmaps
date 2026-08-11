// ── LA RED HELPMAPS ─────────────────────────────────────────────────────────
//
// Cada país donde la solución está desplegada. Alimenta el mapa del hub
// (helpmaps.net): un pin por país, y al tocarlo se abre esa web.
//
// También lo usa cada clon de país para enlazar "otros países" en el pie de página, así
// que mantenerlo al día en el repo base beneficia a todos los despliegues cuando bajan
// cambios.
//
// `status: "preparing"` dibuja el pin sin enlace: anuncia que viene, sin mandar a nadie
// a una URL que todavía no responde.

import type { Deployment } from "@/config/types";

const network: Deployment[] = [
  {
    slug: "co",
    name: "Colombia",
    code: "CO",
    flag: "🇨🇴",
    url: "https://co.helpmaps.net",
    status: "live",
    lat: 4.6,
    lng: -74.1,
    note: "Refugios, puntos de acopio, comedores e iniciativas ciudadanas.",
  },
  {
    slug: "ve",
    name: "Venezuela",
    code: "VE",
    flag: "🇻🇪",
    url: "https://www.helpmapvzla.net",
    status: "live",
    lat: 10.49,
    lng: -66.88,
    note: "Primer despliegue: terremoto de junio de 2026. Personas, refugios y acopios.",
  },
];

export default network;
