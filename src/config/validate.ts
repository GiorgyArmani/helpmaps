// Revisión de la configuración de un despliegue, al ensamblar `SITE`.
//
// Existe por lo que costaba no tenerla: un preset a medio llenar compilaba sin quejarse y
// fallaba en runtime de formas que no señalaban a la causa — un mapa que abría en el
// océano, un filtro de regiones vacío, un aviso legal que todavía decía "TODO".
//
// ── DÓNDE REVIENTA, Y POR QUÉ AHÍ ───────────────────────────────────────────
//
// Los errores solo se lanzan en el SERVIDOR (build y renderizado en servidor). En el
// navegador se avisan por consola y nada más.
//
// No es timidez: `SITE` son datos estáticos resueltos en tiempo de build, así que una
// configuración que pasa el build no puede empezar a fallar después. Todo lo que esto
// detecta se detecta antes de desplegar. Lanzar además en el cliente solo añadiría una
// forma de dejar en blanco el mapa de alguien que está buscando un refugio, y esta
// aplicación no tiene ningún error de configuración que valga eso.
//
// Añadir una regla: error si un despliegue con ese valor manda a alguien a un sitio
// equivocado o deja una función inservible; aviso si es una incoherencia que conviene
// mirar. Ante la duda, aviso.

import type { LocationType } from "@/domain/types";
import { LOCATION_TYPES } from "@/domain/types";
import type { CountryConfig, SiteConfig } from "@/config/types";
import { HUB_HOST } from "~/config/network";

const isServer = typeof window === "undefined";

/** Recorre el preset buscando marcadores del `_template.ts` que nadie completó. */
function findTodos(value: unknown, path: string, out: string[]): void {
  if (typeof value === "string") {
    if (/\bTODO\b/i.test(value)) out.push(`${path}: sigue el marcador del template ("${value}")`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => findTodos(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) findTodos(v, `${path}.${k}`, out);
  }
}

/**
 * El nombre de dominio de una URL, para poder COMPARARLO.
 *
 * Existe porque la comprobación de abajo usaba `entry.url.includes(host)` y una subcadena
 * no distingue un dominio de otro que lo contenga: `https://www.helpmapvzla.net` "incluye"
 * `helpmapvzla.net`, así que Venezuela pasó el control mientras el preset declaraba el apex
 * y la fila el `www`. Eso son dos hosts canónicos distintos según la fila esté publicada o
 * no, y se pagó en la lista blanca de Supabase: cuatro URLs de redirección donde deberían
 * bastar dos.
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function checkCountry(c: CountryConfig, errors: string[]): void {
  const { geo } = c;

  if (!c.slug.trim()) errors.push("country.slug vacío: nombra el espacio de caché y el preset");
  if (!/^[A-Z]{2}$/.test(c.code)) errors.push(`country.code "${c.code}" no es ISO 3166-1 alpha-2 en mayúsculas`);
  if (!c.name.trim()) errors.push("country.name vacío");

  // `host` alimenta siteUrl(), y de ahí salen los enlaces compartidos y las imágenes OG.
  // Con esquema o barra dentro se generan URLs rotas justo en lo que la gente reenvía.
  if (!c.host.trim()) errors.push("country.host vacío: de ahí salen los enlaces compartidos");
  else if (/^https?:\/\//.test(c.host) || c.host.includes("/"))
    errors.push(`country.host "${c.host}" debe ser solo el nombre de dominio, sin esquema ni ruta`);

  if (!/^[a-z]{2}$/.test(geo.geocodeCountry))
    errors.push(`geo.geocodeCountry "${geo.geocodeCountry}" debe ser ISO alpha-2 en minúsculas`);

  const [[south, west], [north, east]] = geo.bounds;
  if (!(south < north)) errors.push(`geo.bounds: sur (${south}) debe ser menor que norte (${north})`);
  if (!(west < east)) errors.push(`geo.bounds: oeste (${west}) debe ser menor que este (${east})`);

  // El encuadre inicial fuera de la caja abre el mapa donde no hay datos — el fallo del
  // template sin tocar, cuyo `center: [0, 0]` es el golfo de Guinea.
  const [clat, clng] = geo.center;
  if (south < north && west < east && (clat < south || clat > north || clng < west || clng > east))
    errors.push(`geo.center [${clat}, ${clng}] cae fuera de geo.bounds: el mapa abriría donde no hay datos`);

  if (c.regions.length === 0) errors.push("country.regions vacío: el filtro por región no tendría nada que ofrecer");

  const seen = new Set<string>();
  for (const r of c.regions) {
    if (seen.has(r.code)) errors.push(`regions: código duplicado "${r.code}" — uno de los dos no se podrá filtrar`);
    seen.add(r.code);
    if (!/^[a-z0-9_]+$/.test(r.code))
      errors.push(`regions["${r.code}"]: el código va en snake_case; se guarda en locations.region`);
    if (south < north && west < east && (r.lat < south || r.lat > north || r.lng < west || r.lng > east))
      errors.push(`regions["${r.code}"]: el centroide [${r.lat}, ${r.lng}] cae fuera de geo.bounds`);
  }

  if (!c.regionNoun.one.trim() || !c.regionNoun.many.trim())
    errors.push("country.regionNoun vacío: es la palabra con la que se etiqueta todo filtro de región");

  for (const [k, v] of Object.entries(c.legal)) {
    if (!String(v).trim()) errors.push(`country.legal.${k} vacío: la página de privacidad lo cita literalmente`);
  }

  findTodos(c, "preset", errors);
}

// Next instancia este módulo una vez por ruta renderizada, así que sin esto un solo aviso
// salía diecinueve veces y enterraba el resto del log del build — que es justo donde
// alguien lo tiene que leer.
let alreadyRan = false;

/**
 * Revisa el kit ensamblado. Lanza en servidor si algo hace el despliegue incorrecto;
 * avisa por consola si solo es una incoherencia.
 */
export function validateConfig(site: SiteConfig): void {
  if (alreadyRan) return;
  alreadyRan = true;

  const errors: string[] = [];
  const warnings: string[] = [];

  checkCountry(site.country, errors);

  // ── Marca ────────────────────────────────────────────────────────────────
  if (site.brand.logo !== null && !site.brand.logo.startsWith("/"))
    errors.push(`brand.logo "${site.brand.logo}" debe ser una ruta bajo public/ que empiece por "/" (o null)`);
  if (!site.brand.contact.email.trim())
    errors.push("brand.contact.email vacío: es el buzón al que llegan sugerencias y voluntariado");
  if (site.brand.contact.whatsapp && !/^\d+$/.test(site.brand.contact.whatsapp))
    errors.push(`brand.contact.whatsapp "${site.brand.contact.whatsapp}" debe ser solo dígitos, sin "+" ni espacios`);
  if (site.brand.contact.instagram.startsWith("@"))
    errors.push('brand.contact.instagram va sin "@"');

  // ── Idioma ───────────────────────────────────────────────────────────────
  if (!site.language.available.includes(site.language.default))
    errors.push(
      `language.default "${site.language.default}" no está en language.available ` +
        `[${site.language.available.join(", ")}]: nadie podría volver al idioma principal`,
    );
  if (site.language.available.length === 0) errors.push("language.available vacío");

  // ── Mapa ─────────────────────────────────────────────────────────────────
  const types = Object.keys(site.map.types) as LocationType[];
  const enabled = types.filter((t) => site.map.types[t].enabled);
  if (enabled.length === 0) errors.push("config/map.ts: ningún tipo de punto activo — el mapa no podría mostrar nada");
  // `Record<LocationType, …>` ya lo exige al compilar; esto cubre una fila de `emergencies`
  // que trae `map` a medias y llegaría aquí sin pasar por el compilador.
  for (const t of LOCATION_TYPES) {
    if (!site.map.types[t]) errors.push(`map.types.${t} falta: typeStyle("${t}") devolvería undefined`);
  }
  if (!site.map.tiles.attribution.trim())
    errors.push("map.tiles.attribution vacío: toda licencia de teselas que valga la pena la exige");
  if (site.map.staleAfterDays <= 0)
    errors.push(`map.staleAfterDays (${site.map.staleAfterDays}) debe ser positivo`);

  // ── Sismos ───────────────────────────────────────────────────────────────
  if (site.hazard.seismic.enabled && !site.hazard.seismic.attribution.trim())
    errors.push("hazard.seismic.attribution vacío: la política de créditos de USGS la exige");

  // ── Integraciones ────────────────────────────────────────────────────────
  const ga = site.integrations.analytics.ga.trim();
  if (ga && !/^G-[A-Z0-9]+$/.test(ga))
    warnings.push(
      `integrations.analytics.ga "${ga}" no tiene la forma "G-XXXXXXXX": gtag.js no registraría nada`,
    );

  // ── Avisos ───────────────────────────────────────────────────────────────

  // Módulos sin portar. El interruptor existe, pero ningún código lo lee: encenderlo hoy
  // no muestra nada y hace creer al equipo local que la función está disponible.
  for (const f of ["patients", "rescued", "missingReports"] as const) {
    if (site.features[f])
      warnings.push(`features.${f} está en true, pero el módulo todavía no está portado: no aparecerá nada`);
  }

  if (site.mode === "hub") {
    // Mismo criterio que `country.host`: de aquí salen las canónicas y el sitemap del hub.
    if (!HUB_HOST.trim()) errors.push("HUB_HOST vacío en config/network.ts");
    else if (/^https?:\/\//.test(HUB_HOST) || HUB_HOST.includes("/"))
      errors.push(`HUB_HOST "${HUB_HOST}" debe ser solo el nombre de dominio, sin esquema ni ruta`);
    if (site.network.length === 0)
      warnings.push("config/network.ts vacío: el mapa del hub no tendría ningún país que mostrar");
  }

  if (site.mode === "country") {
    const entry = site.network.find((d) => d.slug === site.country.slug);
    if (!entry) {
      warnings.push(
        `"${site.country.name}" no aparece en config/network.ts: no saldrá en el mapa del hub ` +
          "ni en el pie de los demás despliegues",
      );
    } else if (entry.status === "live" && hostOf(entry.url) !== site.country.host) {
      // Dos URLs para el mismo país. Puede ser legítimo y transitorio —Venezuela sigue
      // sirviéndose desde su repositorio original mientras migra— pero entonces los
      // enlaces que la gente reenvía (siteUrl(), de `host`) y los del hub (`url`) llevan a
      // sitios distintos, y eso hay que decidirlo, no heredarlo sin mirar.
      //
      // Comparación de HOST y no `includes`: el apex y su `www` se contienen el uno al
      // otro, que es justo el par que hay que separar.
      warnings.push(
        `network["${entry.slug}"].url (${entry.url}) no coincide con el host del preset ` +
          `(${site.country.host}): los enlaces compartidos y los del hub apuntarían a dominios distintos`,
      );
    }
  }

  // ── La caja sísmica de un país no puede alcanzar a otro despliegue ───────
  //
  // `usgs.ts` consulta con `orderby: "magnitude"` y `useQuakes.ts` sólo pide los contornos
  // del evento MAYOR de la caja. Así que una caja que alcanza el territorio de otro
  // despliegue no produce ruido de fondo: produce que el sismo de ESE país secuestre el
  // evento principal, y que "Zona afectada" dibuje su huella de sacudida sobre este mapa.
  //
  // Ya ocurrió, y por eso existe esta regla. Colombia heredó `geo.bounds` —que llega a
  // -66.85 de longitud y mete a Caracas, que está en -66.88— y al ampliar la ventana a
  // 180 días para alcanzar su propio terremoto, el M7.5 de Venezuela del 24 de junio
  // desplazó al M7.4 del Chocó. El mapa de Colombia dibujaba la zona afectada de Caracas:
  // a alguien en Pereira le decía que el daño estaba a mil kilómetros.
  //
  // Es ERROR y no aviso por el criterio de este archivo: manda a alguien al sitio
  // equivocado. Se arregla en el PRESET DEL PAÍS, declarando `hazard.seismic.bounds` —el
  // cinturón sísmico que le importa a esta emergencia, no la silueta del país— así que
  // arreglar un despliegue nunca toca a los otros.
  //
  // Usa las coordenadas que `config/network.ts` ya declara para pintar el mapa del hub:
  // son la ciudad de cada despliegue, que sirve de proxy barato de "territorio ajeno".
  if (site.mode === "country") {
    const [[south, west], [north, east]] = site.hazard.seismic.bounds ?? site.country.geo.bounds;
    for (const other of site.network) {
      if (other.slug === site.country.slug) continue;
      if (other.lat < south || other.lat > north || other.lng < west || other.lng > east) continue;
      errors.push(
        `la caja sísmica de ${site.country.name} contiene ${other.name} (${other.lat}, ${other.lng}): ` +
          `un sismo mayor allí se convertiría en el evento principal de ESTE mapa y "Zona afectada" ` +
          `dibujaría su huella aquí. Declara hazard.seismic.bounds en config/presets/<pais>.ts`,
      );
    }
  }

  const label = `[HelpMaps · ${site.country.slug}]`;
  for (const w of warnings) console.warn(`${label} aviso de configuración — ${w}`);

  if (errors.length > 0) {
    const detail = errors.map((e) => `  · ${e}`).join("\n");
    const msg = `${label} configuración inválida (${errors.length}):\n${detail}`;
    if (isServer) throw new Error(msg);
    console.error(msg);
  }
}
