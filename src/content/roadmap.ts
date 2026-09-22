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
  /** Cuándo, en trimestres contados desde el inicio de la ejecución del plan. */
  when?: LS;
  note?: LS;
  items: LS[];
  /** El «producto final» del bloque en el cronograma del plan: con qué se da por cumplido. */
  goal?: LS;
}

export const ROADMAP_TITLE: LS = { es: "Roadmap", en: "Roadmap", pt: "Roteiro" };

// LA FUENTE es el Plan de Emprendimiento Social (Google Doc del equipo, septiembre de
// 2026): el estado actual sale de su 2.1.1, los bloques de los programas P1 a P8 y las
// fechas del cronograma 2.9. Esto es la cara pública de ese plan y va detrás de él: si
// el plan cambia, se cambia aquí, no al revés.
//
// Lo que el plan todavía se contradice a sí mismo NO pasa a esta página: el monto
// solicitado (225.000 en la portada, 100.000 en la financiera), el «reparto» entre
// iniciativas (el plan también dice que la plataforma no procesa dinero de terceros) y el
// mes de arranque de Learn&Help (6, 12 o 15 según la sección; aquí va el 6, que es el del
// cronograma).
//
// Las metas en cifras son las del piloto en Venezuela y se dicen así, «en el piloto de
// Venezuela», porque esta página la sirven todos los despliegues: en un clon tienen que
// seguir leyéndose como lo que son y no como las metas de ese país.

export const ROADMAP_INTRO: LS = {
  es: "{platform} es un puente permanente en dos sentidos: conecta la necesidad con la ayuda, y el altruismo con las causas. Quien necesita ayuda ve en el mapa dónde conseguirla, sin cuenta y sin dar su nombre; quien quiere ayudar ve qué hace falta, dónde, y a quién le llega lo que da. Funciona todo el año, y cuando ocurre un desastre activa un modo emergencia sobre ese mismo mapa. La meta: servir para atender emergencias, y para aprender a enfrentarlas. Abajo, lo que ya funciona y el plan de los próximos 24 meses, por trimestres contados desde el inicio de su ejecución.",
  en: "{platform} is a permanent bridge that runs both ways: it connects need with help, and goodwill with causes. Someone who needs help sees on the map where to get it, with no account and no name given; someone who wants to help sees what is needed, where, and who receives what they give. It works all year round, and when a disaster strikes it switches on an emergency mode on that same map. The goal: to help people respond to emergencies, and to learn how to face them. Below, what already works and the plan for the next 24 months, in quarters counted from the start of its execution.",
};

export const ROADMAP_NOW: LS = {
  es: "Ahora mismo: {app} está publicando puntos de ayuda y sus necesidades en {country}.",
  en: "Right now: {app} is publishing help points and their needs in {country}.",
};

export const ROADMAP_PHASES: Phase[] = [
  {
    id: "hoy",
    status: "done",
    title: { es: "Lo que ya funciona", en: "What already works", pt: "O que já funciona" },
    note: {
      es: "No es un proyecto en papel: la plataforma está construida, desplegada y en uso, pensada para un teléfono modesto con mala señal.",
      en: "This is not a project on paper: the platform is built, deployed and in use, designed for a modest phone on a bad connection.",
    },
    items: [
      {
        es: "Mapa de puntos de ayuda por tipo (refugios, acopio, comedores, iniciativas ciudadanas), con búsqueda sin acentos, filtro por {region} y una ficha con lo que recibe, lo que necesita hoy, cómo llegar y a quién llamar.",
        en: "A map of help points by type (shelters, donation points, kitchens, civic initiatives), with accent-insensitive search, a filter by {region} and a card with what it receives, what it needs today, how to get there and who to call.",
      },
      {
        es: "Funciona con mala señal: el mapa abre con los últimos datos aunque no haya conexión, y lo avisa.",
        en: "It works on a bad connection: the map opens with the last data even with no connection, and says so.",
      },
      {
        es: "Circula por donde ya se mueve la gente: enlace propio por punto con vista previa en WhatsApp y Telegram, e imagen para redes con el estado y la fecha impresos dentro.",
        en: "It travels where people already are: a link per point with a preview in WhatsApp and Telegram, and a social image with the status and date printed inside it.",
      },
      {
        es: "«Cerca»: los puntos ordenados por distancia real. La ubicación se queda en el teléfono y no se manda a ningún servidor.",
        en: "“Near”: points sorted by real distance. Your location stays on your phone and is never sent to a server.",
      },
      {
        es: "Perfil propio para cada iniciativa: campañas con meta concreta, agenda de actividades, publicaciones, entregas hechas y sus propios gestores. Lo que publica aparece en el feed de novedades.",
        en: "Each initiative has its own profile: campaigns with a concrete goal, an activity calendar, posts, deliveries made and its own managers. What it posts shows up in the news feed.",
      },
      {
        es: "Reconocimiento del voluntariado: experiencia, cinco niveles y medallas, que otorga el servidor y sólo por acciones comprobadas.",
        en: "Volunteer recognition: experience, five levels and badges, granted by the server and only for verified actions.",
      },
      {
        es: "Capas de amenaza en vivo: epicentros y contornos de intensidad del servicio público del USGS, con aviso de que son estimaciones revisables.",
        en: "Live hazard layers: epicentres and intensity contours from the USGS public service, flagged as estimates subject to revision.",
      },
      {
        es: "Emergencias declarables, cada una con su tipo, su alcance, su equipo y su archivo. Varias pueden convivir.",
        en: "Declarable emergencies, each with its type, scope, team and archive. Several can run at once.",
      },
      {
        es: "Código abierto bajo licencia MIT y API pública con atribución. La misma base ya sirve a cinco países modelados.",
        en: "Open source under the MIT licence and a public API with attribution. The same codebase already serves five modelled countries.",
      },
    ],
  },
  {
    id: "mapa-vivo",
    status: "current",
    when: { es: "Todo el año · T1 a T8", en: "All year · Q1 to Q8", pt: "O ano todo · T1 a T8" },
    title: { es: "Mapa vivo y cobertura territorial", en: "A living map, nationwide", pt: "Mapa vivo e cobertura territorial" },
    note: {
      es: "El dato es el activo principal: tiene que ser cierto el día que alguien lo usa, y no sólo durante una emergencia.",
      en: "The data is the main asset: it has to be true on the day someone uses it, not only during an emergency.",
    },
    items: [
      {
        es: "Verificación en terreno, primero en los {regions} priorizados y después en todo el país, con re-verificación periódica.",
        en: "On-the-ground verification, first in the priority {regions} and then nationwide, with periodic re-checks.",
      },
      {
        es: "Una red de verificadores voluntarios formados por la organización, con relevo constante desde instituciones educativas y su servicio comunitario.",
        en: "A network of volunteer verifiers trained by the organisation, with a steady flow of new people from schools and universities through community service.",
      },
      {
        es: "Los avisos de la ciudadanía se aplican en menos de 36 horas, y el dato viejo caduca solo y se señala.",
        en: "Citizen reports are applied within 36 hours, and old data expires on its own and is flagged.",
      },
      {
        es: "Portadas impresas con código QR, repartidas por las organizaciones aliadas, para llegar a quien no está conectado.",
        en: "Printed posters with a QR code, handed out by partner organisations, to reach people who are not online.",
      },
    ],
    goal: {
      es: "900 puntos verificados y cobertura efectiva en los 24 estados al mes 12, en el piloto de Venezuela.",
      en: "900 verified points and effective coverage in all 24 states by month 12, in the Venezuela pilot.",
    },
  },
  {
    id: "constitucion",
    status: "next",
    when: { es: "T1", en: "Q1", pt: "T1" },
    title: { es: "Constitución y puesta en marcha", en: "Incorporation and start-up", pt: "Constituição e arranque" },
    note: {
      es: "Lo que convierte el trabajo de dos fundadores en una organización que puede firmar convenios y rendir cuentas.",
      en: "What turns the work of two founders into an organisation that can sign agreements and be held to account.",
    },
    items: [
      {
        es: "Constitución como asociación civil sin fines de lucro: es la condición de todo lo demás.",
        en: "Incorporation as a non-profit civil association: everything else depends on it.",
      },
      {
        es: "Equipo mínimo permanente: coordinación de campo y verificación, y coordinación de comunicación y comunidad.",
        en: "A small permanent team: field and verification coordination, and communication and community coordination.",
      },
      {
        es: "Protocolo de verificación publicado: cómo se comprueba un punto y una organización, y quién decide las altas y las bajas.",
        en: "A published verification protocol: how a point and an organisation are checked, and who decides what goes in and out.",
      },
      {
        es: "Línea base de todos los indicadores, medida sobre lo que la plataforma ya registra y no sobre encuestas.",
        en: "A baseline for every indicator, measured on what the platform already records rather than on surveys.",
      },
    ],
    goal: {
      es: "Organización constituida, equipo contratado y protocolo publicado.",
      en: "Organisation incorporated, team hired and protocol published.",
    },
  },
  {
    id: "emergencia",
    status: "next",
    when: { es: "T2 a T7", en: "Q2 to Q7", pt: "T2 a T7" },
    title: { es: "Modo emergencia y respuesta inmediata", en: "Emergency mode and rapid response", pt: "Modo emergência e resposta imediata" },
    note: {
      es: "El modo permanente es la condición del modo emergencia: cuando pasa algo, el mapa, el equipo y la comunidad ya existen, y la tragedia se hace visible en horas y no en semanas.",
      en: "The permanent mode is what makes the emergency mode possible: when something happens, the map, the team and the community already exist, and the disaster becomes visible in hours rather than weeks.",
    },
    items: [
      {
        es: "Protocolo para abrir, cubrir y archivar una emergencia.",
        en: "A protocol to open, cover and archive an emergency.",
      },
      {
        es: "Simulacros con Protección Civil, midiendo cuánto se tarda en abrir una emergencia.",
        en: "Drills with Civil Protection, measuring how long it takes to open an emergency.",
      },
      {
        es: "Convenios de activación previa con organismos de respuesta, firmados antes de que haga falta.",
        en: "Pre-activation agreements with response agencies, signed before they are needed.",
      },
      {
        es: "Varias emergencias a la vez, cada una con su propio equipo local y un acceso limitado a su evento.",
        en: "Several emergencies at once, each with its own local team and access limited to its event.",
      },
    ],
    goal: {
      es: "Una emergencia declarada y publicada en menos de 12 horas, ensayada dos veces.",
      en: "An emergency declared and published in under 12 hours, rehearsed twice.",
    },
  },
  {
    id: "comunidad",
    status: "next",
    when: { es: "T2 a T8", en: "Q2 to Q8", pt: "T2 a T8" },
    title: { es: "Iniciativas, voluntariado y comunidad", en: "Initiatives, volunteers and community", pt: "Iniciativas, voluntariado e comunidade" },
    note: {
      es: "Los dos puentes: que una iniciativa pequeña demuestre su trabajo y capte apoyo sin intermediarios, y que quien quiere ayudar encuentre dónde hace falta lo que sabe hacer.",
      en: "Both bridges: a small initiative can show its work and win support with no middlemen, and someone who wants to help finds where what they can do is needed.",
    },
    items: [
      {
        es: "Las iniciativas gestionan su propio perfil, con formación en campañas de recaudación, eventos y publicaciones. La meta es que el equipo de {platform} deje de ser necesario.",
        en: "Initiatives manage their own profile, with training in fundraising campaigns, events and posts. The aim is for the {platform} team to stop being necessary.",
      },
      {
        es: "Perfil de voluntario con disponibilidad y oficios. En cada punto y cada actividad la iniciativa dice si le faltan manos, oficios, donación en especie o difusión.",
        en: "A volunteer profile with availability and skills. At each point and activity, the initiative says whether it needs hands, skills, in-kind donations or outreach.",
      },
      {
        es: "Seguir a una iniciativa y recibir lo que publica sin tener que ir a buscarlo. Consultar el mapa sigue siendo anónimo: la cuenta es para quien vuelve.",
        en: "Follow an initiative and get what it posts without going looking for it. Reading the map stays anonymous: the account is for people who come back.",
      },
      {
        es: "Talleres de preparación ante desastres en las comunidades.",
        en: "Disaster-preparedness workshops in communities.",
      },
    ],
    goal: {
      es: "120 iniciativas gestionando su perfil y 1.500 voluntarios registrados al mes 12, en el piloto de Venezuela.",
      en: "120 initiatives managing their own profile and 1,500 registered volunteers by month 12, in the Venezuela pilot.",
    },
  },
  {
    id: "learn-help",
    status: "next",
    when: { es: "T1 a T8 · lanzamiento en el mes 6", en: "Q1 to Q8 · launch in month 6", pt: "T1 a T8 · lançamento no mês 6" },
    title: { es: "Learn&Help: aprender a enfrentar emergencias", en: "Learn&Help: learning to face emergencies", pt: "Learn&Help: aprender a enfrentar emergências" },
    note: {
      es: "Recorridos de aprendizaje con forma de juego sobre cómo prepararse, responder y organizarse ante un desastre, y sobre cómo usar {platform}. Cada nivel deja un certificado en el perfil y abre recompensas.",
      en: "Game-like learning paths on how to prepare for, respond to and organise around a disaster, and on how to use {platform}. Each level leaves a certificate on your profile and unlocks rewards.",
    },
    items: [
      {
        es: "App nativa y primer recorrido, con el diseño instruccional hecho junto a universidades, bomberos y Protección Civil.",
        en: "A native app and the first learning path, with instructional design done alongside universities, firefighters and Civil Protection.",
      },
      {
        es: "Suscripción de US$ 5 al mes. El primer nivel es gratis, y todo es gratis durante una emergencia.",
        en: "A US$ 5 monthly subscription. The first level is free, and all of it is free during an emergency.",
      },
      {
        es: "Plazas para empresas e instituciones educativas que quieran formar a su gente en preparación ante desastres.",
        en: "Seats for companies and schools that want to train their people in disaster preparedness.",
      },
      {
        es: "Recorridos nuevos cada trimestre, validados con los aliados.",
        en: "New learning paths every quarter, validated with partners.",
      },
    ],
  },
  {
    id: "ayuda-mas",
    status: "later",
    when: { es: "T5 a T8", en: "Q5 to Q8", pt: "T5 a T8" },
    title: { es: "Ayuda+: recompensas con comercios aliados", en: "Ayuda+: rewards with partner businesses", pt: "Ayuda+: recompensas com comércios parceiros" },
    note: {
      es: "Los comercios cubren su cuota social con beneficios para quien ayudó, y {platform} pone la constancia de que esa persona ayudó de verdad.",
      en: "Businesses meet their social commitment with perks for people who helped, and {platform} provides the proof that the person really did.",
    },
    items: [
      {
        es: "Canje de beneficios por nivel en comercios patrocinantes.",
        en: "Perks redeemed by level at sponsoring businesses.",
      },
      {
        es: "Patrocinio de campañas, con la entrega publicada junto a la campaña que financió.",
        en: "Campaign sponsorship, with the delivery published next to the campaign it paid for.",
      },
      {
        es: "Aparecer es opcional: se puede ayudar sin figurar en ninguna lista.",
        en: "Appearing is optional: you can help without showing up on any list.",
      },
    ],
  },
  {
    id: "sostenibilidad",
    status: "next",
    when: { es: "T2 a T8", en: "Q2 to Q8", pt: "T2 a T8" },
    title: {
      es: "De qué vive {platform}, y cómo rinde cuentas",
      en: "What keeps {platform} alive, and how it reports",
      pt: "Do que vive {platform}, e como presta contas",
    },
    note: {
      es: "Una plataforma que no dice de qué vive acaba viviendo de algo que no cuenta. {platform} no procesa dinero de terceros ni cobra comisión sobre ninguna donación: lo que se da a una iniciativa le llega entero y directo.",
      en: "A platform that does not say what keeps it alive ends up living off something it does not mention. {platform} does not handle other people's money or take a cut of any donation: what is given to an initiative reaches it whole and directly.",
    },
    items: [
      {
        es: "Subvenciones y cooperación para la puesta en marcha, con peso decreciente año a año.",
        en: "Grants and cooperation funding for the start-up, weighing less each year.",
      },
      {
        es: "Ingresos propios: Learn&Help, un aporte voluntario a {platform} al lado del botón de donar (aparte de verdad, con otros datos de cobro), el servicio de implantación en otros países e instituciones, y el acceso a datos verificados para instituciones (mes 24).",
        en: "Own income: Learn&Help, a voluntary contribution to {platform} beside the donate button (genuinely separate, with different payment details), the deployment service for other countries and institutions, and access to verified data for institutions (month 24).",
      },
      {
        es: "Auditoría externa del primer ejercicio, e informe anual de transparencia e impacto publicado.",
        en: "An external audit of the first year, and a published annual transparency and impact report.",
      },
    ],
  },
  {
    id: "red",
    status: "later",
    title: { es: "Red {platform}", en: "The {platform} network", pt: "Rede {platform}" },
    note: {
      es: "Que el trabajo hecho para un país sirva a los demás.",
      en: "So the work done for one country serves the others.",
    },
    items: [
      {
        es: "Implantación en nuevos países e instituciones: un país es un archivo de configuración y una base de datos propia, no un proyecto nuevo.",
        en: "Deployment in new countries and institutions: a country is a configuration file and its own database, not a new project.",
      },
      {
        es: "Cada mejora que paga un despliegue llega a todos, incluido el de Venezuela, que es gratuito.",
        en: "Every improvement one deployment pays for reaches all of them, including Venezuela's, which is free.",
      },
      {
        es: "La API pública y la licencia abierta como estándar de datos de ayuda para Protección Civil, alcaldías, medios y cooperación.",
        en: "The public API and open licence as an aid-data standard for Civil Protection, municipalities, the media and cooperation agencies.",
      },
      {
        es: "Guía para que un equipo nuevo levante su despliegue sin ayuda técnica externa.",
        en: "A guide so a new team can stand up its deployment without outside technical help.",
      },
    ],
  },
];
