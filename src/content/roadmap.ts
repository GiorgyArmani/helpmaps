import type { Lang } from "@/i18n/types";
import { BRAND, COUNTRY } from "@/config";

// Shared plumbing for the long-form content (docs + roadmap), plus the roadmap itself.
//
// The content in this folder is TEMPLATE content: it describes what HelpMaps does, not
// what one country's deployment did. A clone edits it to match its own operation — but
// it should read correctly on day one, before anyone edits anything, which is why the
// strings use tokens instead of naming a country.

/**
 * Trilingual string. `pt` is optional on purpose: long-form prose is expensive to
 * translate and an untranslated section falls back to Spanish, which is far closer to
 * Portuguese than an English fallback would be.
 */
export type LS = { es: string; en: string; pt?: string };

/**
 * Tokens the content may use so it adapts to the deployment without being rewritten:
 *
 *   {app}      this deployment       "HelpMaps Colombia"
 *   {platform} the project itself    "HelpMaps"
 *   {country}  country name          "Colombia"
 *   {host}     canonical host        "co.helpmaps.net"
 *   {region}   what a division is    "departamento"
 *   {regions}  plural of the above   "departamentos"
 *   {email}    public contact
 */
export function fillTokens(value: string): string {
  return value
    .replace(/\{app\}/g, BRAND.name)
    .replace(/\{platform\}/g, BRAND.platform)
    .replace(/\{country\}/g, COUNTRY.name)
    .replace(/\{host\}/g, COUNTRY.host)
    .replace(/\{region\}/g, COUNTRY.regionNoun.one)
    .replace(/\{regions\}/g, COUNTRY.regionNoun.many)
    .replace(/\{email\}/g, BRAND.contact.email);
}

/** Pick a language and resolve the deployment tokens. Used by every docs renderer. */
export const tr = (o: LS, lang: Lang): string =>
  fillTokens(lang === "pt" ? (o.pt ?? o.es) : o[lang]);

export type PhaseStatus = "done" | "current" | "next" | "later";

export const PHASE_META: Record<PhaseStatus, { dot: string; label: LS }> = {
  done: { dot: "#1c8a4e", label: { es: "Completado", en: "Done", pt: "Concluído" } },
  current: {
    dot: "#2563eb",
    label: { es: "En curso", en: "In progress", pt: "Em andamento" },
  },
  next: { dot: "#b45309", label: { es: "Próximo", en: "Next", pt: "Próximo" } },
  later: { dot: "#7b818c", label: { es: "Más adelante", en: "Later", pt: "Mais adiante" } },
};

export interface Phase {
  id: string;
  title: LS;
  status: PhaseStatus;
  note?: LS;
  items: LS[];
}

export const ROADMAP_TITLE: LS = { es: "Roadmap", en: "Roadmap", pt: "Roteiro" };

export const ROADMAP_INTRO: LS = {
  es: "{platform} es una plataforma cívica abierta para emergencias: por un lado, quien necesita ayuda encuentra dónde conseguirla; por otro, quien quiere ayudar ve exactamente qué hace falta y dónde. Nació de una respuesta ciudadana real y hoy se despliega país por país. Abajo, lo que ya funciona y hacia dónde vamos.",
  en: "{platform} is an open civic platform for emergencies: on one side, someone who needs help finds where to get it; on the other, someone who wants to help sees exactly what is needed and where. It came out of a real citizen response and today it is deployed country by country. Below, what already works and where we are going.",
};

export const ROADMAP_NOW: LS = {
  es: "Ahora mismo: {app} está publicando puntos de ayuda y sus necesidades en {country}.",
  en: "Right now: {app} is publishing help points and their needs in {country}.",
};

export const ROADMAP_PHASES: Phase[] = [
  {
    id: "p1",
    status: "done",
    title: { es: "Fundación", en: "Foundation", pt: "Fundação" },
    note: {
      es: "El núcleo: un mapa que se abre rápido en un teléfono cualquiera y con mala señal.",
      en: "The core: a map that opens fast on any phone and a bad connection.",
    },
    items: [
      {
        es: "Mapa con puntos de ayuda por tipo: refugios, puntos de acopio, comedores e iniciativas ciudadanas.",
        en: "Map of help points by type: shelters, donation points, kitchens and civic initiatives.",
      },
      {
        es: "Búsqueda sin acentos, filtro por {region} y por tipo, y agrupación al alejar el zoom.",
        en: "Accent-insensitive search, filters by {region} and by type, clustering as you zoom out.",
      },
      {
        es: "Ficha de cada punto con lo que recibe, lo que necesita ahora, cómo llegar y a quién llamar.",
        en: "A card per point with what it receives, what it needs now, how to get there and who to call.",
      },
      {
        es: "Caché local: el mapa abre con los últimos datos aunque no haya conexión, y lo avisa.",
        en: "Local cache: the map opens with the last data even with no connection, and says so.",
      },
    ],
  },
  {
    id: "p2",
    status: "done",
    title: { es: "Circulación", en: "Circulation", pt: "Circulação" },
    note: {
      es: "Un mapa que nadie comparte no ayuda a nadie: la información tiene que viajar por donde ya se mueve la gente.",
      en: "A map nobody shares helps nobody: the information has to travel where people already are.",
    },
    items: [
      {
        es: "Enlace propio por punto con vista previa en WhatsApp y Telegram.",
        en: "A link per point with a preview card in WhatsApp and Telegram.",
      },
      {
        es: "Imagen para redes en tres formatos, con el estado del punto y la fecha dentro de la imagen.",
        en: "A social image in three formats, with the point's status and date inside the image.",
      },
      {
        es: "Lista de «dónde hace falta ayuda» para quien quiere colaborar y no sabe por dónde empezar.",
        en: "A “where help is needed” list for anyone who wants to help and does not know where to start.",
      },
    ],
  },
  {
    id: "p3",
    status: "done",
    title: { es: "Confianza", en: "Trust", pt: "Confiança" },
    note: {
      es: "Publicar rápido y publicar bien no son lo mismo. Esta fase es la que hace que el dato se pueda creer.",
      en: "Publishing fast and publishing well are not the same thing. This phase is what makes the data believable.",
    },
    items: [
      {
        es: "Estado del punto (abierto, lleno, cerrado) y aviso cuando nadie lo confirma hace días.",
        en: "Point status (open, full, closed) and a warning when nobody has confirmed it in days.",
      },
      {
        es: "Equipo verificado que publica en vivo, con acceso revocable y bitácora de cada cambio.",
        en: "A vetted team that publishes live, with revocable access and a log of every change.",
      },
      {
        es: "Sugerencias del público en cola: cualquiera aporta, una persona confirma antes de publicar.",
        en: "Public suggestions in a queue: anyone contributes, a person confirms before publishing.",
      },
      {
        es: "Protección de datos por diseño: se publica el lugar y la necesidad, nunca el contacto de quien reporta.",
        en: "Data protection by design: the place and the need are published, never the reporter's contact.",
      },
    ],
  },
  {
    id: "p4",
    status: "current",
    title: { es: "Despliegue por país", en: "Country deployments", pt: "Implantação por país" },
    note: {
      es: "El repositorio es la base; cada país es una clonación con su configuración, su base de datos y su equipo local.",
      en: "The repository is the base; each country is a clone with its own configuration, database and local team.",
    },
    items: [
      {
        es: "Un archivo de configuración por país: regiones, encuadre del mapa, marca, idioma y funciones activas.",
        en: "One configuration folder per country: regions, map viewport, brand, language and active features.",
      },
      {
        es: "Base de datos separada por país, para que la información de uno no se pueda leer desde otro.",
        en: "A separate database per country, so one country's information cannot be read from another.",
      },
      {
        es: "API pública para que otras aplicaciones humanitarias consuman los puntos verificados.",
        en: "A public API so other humanitarian applications can consume the verified points.",
      },
    ],
  },
  {
    id: "p5",
    status: "next",
    title: { es: "Personas afectadas", en: "Affected people", pt: "Pessoas afetadas" },
    note: {
      es: "Localizar personas es el uso más delicado de la plataforma, y solo se activa donde exista una red que confirme cada dato.",
      en: "Locating people is the platform's most delicate use, and it is only switched on where a network exists to confirm every record.",
    },
    items: [
      {
        es: "Listado de personas atendidas en un centro, para reunificación familiar.",
        en: "A list of people attended at a centre, for family reunification.",
      },
      {
        es: "Regla que no se negocia: solo lo mínimo para reconocer a alguien; nada de domicilio ni de datos clínicos.",
        en: "A non-negotiable rule: only the minimum needed to recognise someone; no home address, no clinical data.",
      },
      {
        es: "Protección reforzada de menores de edad en todas las capas.",
        en: "Reinforced protection for minors at every layer.",
      },
      {
        es: "Reporte privado de personas buscadas, visible solo para el equipo.",
        en: "Private missing-person reports, visible to the team only.",
      },
    ],
  },
  {
    id: "p6",
    status: "later",
    title: { es: "Red entre despliegues", en: "Network between deployments", pt: "Rede entre implantações" },
    items: [
      {
        es: "Intercambio de datos con otras plataformas de ayuda, con atribución y licencia abierta.",
        en: "Data exchange with other aid platforms, with attribution and an open licence.",
      },
      {
        es: "Sincronización de puntos desde fuentes locales ya existentes, sin duplicar el trabajo de nadie.",
        en: "Syncing points from existing local sources, without duplicating anyone's work.",
      },
      {
        es: "Guía operativa para que un equipo nuevo levante su despliegue sin ayuda técnica externa.",
        en: "An operational guide so a new team can stand up its deployment without outside technical help.",
      },
    ],
  },
];
