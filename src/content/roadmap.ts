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
  es: "{platform} es una plataforma cívica abierta para emergencias: por un lado, quien necesita ayuda encuentra dónde conseguirla —sin cuenta y sin dar su nombre—; por otro, quien quiere ayudar ve exactamente qué hace falta, dónde, y a quién le llega lo que da. Nació de una respuesta ciudadana real y hoy se despliega país por país. Abajo, lo que ya funciona y hacia dónde vamos.",
  en: "{platform} is an open civic platform for emergencies: on one side, someone who needs help finds where to get it — no account, no name given; on the other, someone who wants to help sees exactly what is needed, where, and who receives what they give. It came out of a real citizen response and today it is deployed country by country. Below, what already works and where we are going.",
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
    id: "cerca",
    status: "current",
    title: { es: "Cerca de ti", en: "Near you", pt: "Perto de você" },
    note: {
      es: "Un mapa de todo el país responde a una pregunta que nadie hace. La pregunta real es «¿qué hay cerca de mí, ahora mismo?», y se contesta sin pedir cuenta ni nombre.",
      en: "A map of the whole country answers a question nobody asks. The real question is “what is near me, right now?”, and it is answered without asking for an account or a name.",
    },
    items: [
      {
        es: "Pestaña «Cerca»: los puntos ordenados por distancia real, con el radio a elegir.",
        en: "A “Near” tab: points sorted by real distance, with the radius you choose.",
      },
      {
        es: "Las iniciativas sin sede que cubren tu zona salen en la misma lista, marcadas como cobertura y no como sitio al que ir.",
        en: "Initiatives with no seat that cover your area appear in the same list, marked as coverage and not as a place to travel to.",
      },
      {
        es: "Tu ubicación se queda en tu teléfono: sirve para ordenar la lista y no se manda a ningún servidor ni se guarda.",
        en: "Your location stays on your phone: it is used to sort the list and is never sent to a server or stored.",
      },
      {
        // Sin artículo antes de `{region}`: el sustantivo lo pone cada país y no siempre
        // tiene el mismo género — «la estado» y «la departamento» estaban saliendo así.
        es: "Sin permiso de ubicación la lista no se rompe: se sigue pudiendo filtrar por {region} como siempre.",
        en: "With no location permission the list does not break: filtering by {region} still works as it always did.",
      },
    ],
  },
  {
    id: "comunidad",
    status: "next",
    title: { es: "Cuentas y comunidad", en: "Accounts and community", pt: "Contas e comunidade" },
    note: {
      es: "La cuenta no es un peaje: consultar el mapa sigue siendo anónimo para siempre. La cuenta es para quien vuelve — para seguir a una iniciativa y enterarse de lo suyo sin tener que ir a buscarla.",
      en: "An account is not a toll: reading the map stays anonymous forever. The account is for whoever comes back — to follow an initiative and hear from it without having to go looking.",
    },
    items: [
      {
        es: "Seguir una iniciativa y ver lo que publica en tu feed, junto a lo que hay cerca.",
        en: "Follow an initiative and see what it posts in your feed, next to what is nearby.",
      },
      {
        es: "Publican sólo las iniciativas verificadas: avances, entregas hechas y lo que hace falta hoy. Sin comentarios abiertos en esta etapa — lo que no se abre no hay que moderarlo.",
        en: "Only vetted initiatives post: progress, deliveries made, what is needed today. No open comments at this stage — what is not opened does not need moderating.",
      },
      {
        es: "Perfil de voluntario: en qué puede ayudar y cuándo, para que una iniciativa cercana pueda pedírselo.",
        en: "A volunteer profile: what they can help with and when, so a nearby initiative can ask.",
      },
      {
        es: "La regla de privacidad no se mueve: el correo nunca sale de donde vive, y lo que revela por dónde anda una persona no lo ve nadie más que ella.",
        en: "The privacy rule does not move: an email never leaves where it lives, and what reveals where a person goes is seen by nobody but them.",
      },
    ],
  },
  {
    id: "iniciativas",
    status: "next",
    title: {
      es: "Lo que gana una iniciativa",
      en: "What an initiative gets out of this",
      pt: "O que uma iniciativa ganha",
    },
    note: {
      es: "Un mapa al que las iniciativas no ganan nada por entrar se queda sin iniciativas. Su perfil deja de ser una ficha que otros llenan y pasa a ser su espacio: lo que están recaudando, lo que van a hacer y lo que ya entregaron.",
      en: "A map initiatives gain nothing by joining ends up with no initiatives. Their profile stops being a record other people fill in and becomes their own space: what they are raising, what they are about to do, and what they already delivered.",
    },
    items: [
      {
        es: "Campañas con una meta concreta: para qué es, cuánto hace falta, cuánto lleva y hasta cuándo. Recaudar «para el comedor» no mueve a nadie; «120 colchonetas antes del viernes» sí.",
        en: "Campaigns with a concrete goal: what it is for, how much is needed, how much is in, and until when. Raising “for the kitchen” moves nobody; “120 mattresses before Friday” does.",
      },
      {
        es: "Agenda de lo que van a hacer en su comunidad, para que la gente de al lado pueda ir, llevar algo o sumarse como voluntaria.",
        en: "A calendar of what they will do in their community, so the people next door can show up, bring something, or join as volunteers.",
      },
      {
        es: "Trazabilidad: cada entrega hecha queda publicada junto a la campaña que la pagó. Es lo que convierte «confía en nosotros» en algo que se puede mirar.",
        en: "Traceability: every delivery made is published next to the campaign that paid for it. That is what turns “trust us” into something you can look at.",
      },
      {
        es: "Visibilidad: aparecer en «Cerca» de su zona, en el feed de quien las sigue y con enlace propio para compartir por WhatsApp.",
        en: "Visibility: showing up in “Near” for their area, in the feed of whoever follows them, and with their own link to share on WhatsApp.",
      },
    ],
  },
  {
    id: "dar",
    status: "next",
    title: { es: "Dar, y que se note", en: "Giving, and being seen", pt: "Doar, e que apareça" },
    note: {
      es: "El piloto arranca por lo simple y lo comprobable: donas a la iniciativa que tú elijas, con los datos que ella misma publicó. {platform} todavía no se pone en medio del dinero.",
      en: "The pilot starts with the simple, checkable thing: you donate to the initiative you choose, with the details it published itself. {platform} does not sit in the middle of the money yet.",
    },
    items: [
      {
        es: "Donar directo a una iniciativa desde su ficha, con sus propios datos de cobro y su enlace verificable.",
        en: "Donate straight to an initiative from its card, with its own payment details and a checkable link.",
      },
      {
        es: "Al lado, y aparte: la opción de aportar a {platform} para sostenerla. Aparte de verdad —otros datos de cobro, otra decisión— porque lo que se da a una iniciativa tiene que llegarle entero. Así es como se paga esto mientras el fondo común no exista.",
        en: "Beside it, and separate: the option to chip in to {platform} to keep it running. Genuinely separate — different payment details, a different decision — because what is given to an initiative has to reach it whole. This is how this gets paid for while the common fund does not exist.",
      },
      {
        es: "Medallas por lo que hiciste —donar, reportar un punto, salir a voluntariar— y una tabla de posiciones para quien quiera aparecer en ella.",
        en: "Badges for what you did — donate, report a point, show up to volunteer — and a leaderboard for whoever wants to be on it.",
      },
      {
        es: "Aparecer es opcional: se puede donar y voluntariar sin figurar en ninguna lista.",
        en: "Appearing is optional: you can donate and volunteer without showing up in any list.",
      },
      {
        es: "Las medallas se canjean por beneficios en comercios patrocinantes: el comercio pone el beneficio, {platform} pone la constancia de que esa persona ayudó.",
        en: "Badges are redeemed for perks at sponsoring businesses: the business puts up the perk, {platform} puts up the proof that this person helped.",
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
    id: "fondo",
    status: "later",
    title: {
      es: "Fondo común, y de qué vive {platform}",
      en: "The common fund, and what keeps {platform} alive",
      pt: "Fundo comum, e do que vive {platform}",
    },
    note: {
      es: "Una plataforma que no dice de qué vive acaba viviendo de algo que no cuenta. Aquí está dicho: una sola aportación mensual que llega repartida a TODAS las iniciativas, y una comisión declarada que sostiene la plataforma. Implica mover dinero de terceros, así que no se lanza hasta que el reparto se pueda auditar desde fuera y el riel de cobro exista de verdad en el país del piloto.",
      en: "A platform that does not say what keeps it alive ends up living off something it does not mention. Here it is stated: one monthly contribution that arrives split across EVERY initiative, and a declared fee that sustains the platform. It means handling other people's money, so it does not ship until the split can be audited from outside and a payment rail actually exists in the pilot country.",
    },
    items: [
      {
        es: "Voluntario+: aportación mensual de la que un 5–10% sostiene {platform} y el resto entra al fondo.",
        en: "Volunteer+: a monthly contribution of which 5–10% sustains {platform} and the rest goes into the fund.",
      },
      {
        es: "Reparto equitativo entre las iniciativas activas: con una sola aportación ayudas a todas a la vez.",
        en: "An equitable split across active initiatives: one contribution helps all of them at once.",
      },
      {
        es: "Transparencia absoluta y por defecto: cuánto entró, cuánto se quedó la plataforma, cuánto le tocó a cada iniciativa y en qué fecha. Público, sin que nadie lo pida.",
        en: "Absolute transparency by default: how much came in, how much the platform kept, how much each initiative got and on what date. Public, without anyone having to ask.",
      },
      {
        es: "El cobro: en Venezuela el débito recurrente no está resuelto, así que la vía es una alianza con una entidad financiera local que lo opere. Hasta que exista, Voluntario+ se queda apagado y vale lo de la fase anterior: donación directa.",
        en: "The charge: recurring debit is not a solved problem in Venezuela, so the route is a partnership with a local financial institution that operates it. Until that exists, Volunteer+ stays off and the previous phase stands: direct donation.",
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
