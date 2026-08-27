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
    slug: "es",
    name: "España",
    code: "ES",
    flag: "🇪🇸",
    url: "https://es.helpmaps.net",
    status: "preparing",
    lat: 40.42,
    lng: -3.7,
    note: "Serie sísmica de Granada de agosto de 2026: albergues, puntos de recogida e iniciativas vecinales.",
  },
  {
    slug: "id",
    name: "Indonesia",
    code: "ID",
    flag: "🇮🇩",
    url: "https://id.helpmaps.net",
    // "preparing" hasta que responda el DNS. La interfaz sale en inglés: no hay
    // diccionario en indonesio y se decidió no retener el despliegue por ello (ver el
    // preset), pero es una limitación que conviene recordar al anunciarlo.
    status: "preparing",
    lat: -6.18,
    lng: 106.83,
    note: "Terremoto M 7.7 del 15 de agosto de 2026 frente a Flores (Nusa Tenggara Timur).",
  },
  {
    slug: "pe",
    name: "Perú",
    code: "PE",
    flag: "🇵🇪",
    url: "https://pe.helpmaps.net",
    // ⚠️ "preparing" mientras el DNS de pe.helpmaps.net no responda: dibuja el pin en el
    // hub y lo anuncia, sin mandar a nadie a una URL muerta justo cuando busca un
    // albergue. El día que el despliegue esté arriba, esta línea pasa a "live" — y
    // `src/config/validate.ts` avisa en cada build si la URL deja de coincidir con el
    // `host` del preset.
    status: "preparing",
    lat: -12.05,
    lng: -77.04,
    note: "Sismo M 6.7 del 20 de agosto de 2026 en Ayacucho: albergues, puntos de acopio e iniciativas ciudadanas.",
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
