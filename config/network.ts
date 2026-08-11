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

/**
 * El dominio del hub. Solo el nombre, sin esquema ni barra.
 *
 * Vive aquí y no en una variable de entorno porque el hub no tiene país, y sin este valor
 * `siteUrl()` caía al `host` del país por defecto: el hub en helpmaps.net publicaba un
 * sitemap, canónicas e imágenes OG que decían co.helpmaps.net — es decir, se anunciaba a
 * los buscadores como una copia de Colombia y sus tarjetas al compartir llevaban allí.
 * NEXT_PUBLIC_SITE_URL sigue ganando sobre esto, para previews y desarrollo.
 */
export const HUB_HOST = "helpmaps.net";

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
    // ⚠️ Esta URL NO coincide con el `host` del preset (ve.helpmaps.net), y es a
    // propósito: el despliegue vivo de Venezuela todavía corre desde su repositorio
    // original, y el preset apunta a dónde quedará cuando migre. Aquí va la que
    // responde hoy — mandar al hub a un dominio que aún no existe es peor que la
    // incoherencia. `src/config/validate.ts` avisa de esto en cada build de VE; el aviso
    // se apaga solo el día que la migración termine y ambos digan ve.helpmaps.net.
    url: "https://www.helpmapvzla.net",
    status: "live",
    lat: 10.49,
    lng: -66.88,
    note: "Primer despliegue: terremoto de junio de 2026. Personas, refugios y acopios.",
  },
];

export default network;
