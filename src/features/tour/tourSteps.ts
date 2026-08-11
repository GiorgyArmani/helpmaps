import type { AdminTab } from "@/features/tour/types";

// ---------------------------------------------------------------------------
// Content for the guided tours: the step decks, plus the handles a step may use to
// drive the app. The engine that measures, spotlights and paginates them lives in
// GuidedTour.tsx — keeping the copy here stops that file from becoming 700 lines of
// translated prose.
//
//   PUBLIC_STEPS — first-run visitor walkthrough.
//   STAFF_STEPS  — onboarding for whoever gets panel access.
//
// This is TEMPLATE copy: it explains the two things HelpMaps is for — finding help and
// offering it — without naming one country or one emergency. A clone rewrites it to
// match its own operation.
//
// A step whose anchor is missing right now is skipped silently by the engine, which is
// what lets one deck serve every role and screen size: a control that a country has not
// enabled simply never gets a step.
// ---------------------------------------------------------------------------

export type L10n = { es: string; en: string; pt: string };

// The handles the tour needs to drive the app. Deliberately small: everything here is
// an existing app function, not new behaviour.
export type TourCtl = {
  closeViews: () => void; // an open overlay would cover every target
  showSheet: (open: boolean) => void;
  setFabOpen: (open: boolean) => void;
  clearCenter: () => void; // deselect, so the needs bar is reachable
  openSample: () => void; // open a real record as a live example (no-op if none loaded)
  openDonate: () => void;
  openVolunteer: () => void;
  // --- staff tour only ---
  openAdmin: () => void;
  switchTab: (tab: AdminTab) => void;
  editSample: () => void;
  clearEdit: () => void;
};

export type TourStep = {
  id: string;
  // data-tour id(s) of the element(s) to spotlight. Several ids = one ring around their
  // union (used for adjacent header buttons that read as a single control).
  anchor?: string | string[];
  // Normally a step whose anchor is absent is skipped: pointing at a control this user
  // does not have is pointless. `soft` marks the exception — a step that TEACHES
  // something whose example may or may not be on screen right now. Absent anchor → shown
  // as a plain card instead of vanishing, so onboarding never silently drops a concept.
  soft?: boolean;
  eyebrow: L10n;
  title: L10n;
  body: L10n;
  hint?: L10n; // "try it" line — shown only when the target is live and tappable
  bullets?: L10n[];
  cta?: "donate" | "volunteer";
  before?: (c: TourCtl) => void;
  after?: (c: TourCtl) => void;
  pad?: number; // extra px around the target rect
  // Path to the doc this step points at (rendered as a link).
  docs?: string;
};

export const PUBLIC_STEPS: TourStep[] = [
  {
    id: "welcome",
    eyebrow: { es: "Bienvenido", en: "Welcome", pt: "Bem-vindo" },
    title: {
      es: "Encontrar ayuda y ofrecerla",
      en: "Finding help and offering it",
      pt: "Encontrar ajuda e oferecê-la",
    },
    body: {
      es: "Este mapa sirve para dos cosas: si necesitas algo, te dice dónde conseguirlo; si quieres ayudar, te dice qué hace falta y dónde. Te mostramos la app paso a paso: cada paso resalta el botón real y puedes tocarlo para probarlo.",
      en: "This map does two things: if you need something, it tells you where to get it; if you want to help, it tells you what is needed and where. We'll walk you through it step by step: each step highlights the real button and you can tap it to try it.",
      pt: "Este mapa serve para duas coisas: se você precisa de algo, mostra onde conseguir; se quer ajudar, mostra o que falta e onde. Vamos guiar você passo a passo: cada passo destaca o botão real e você pode tocá-lo para testar.",
    },
    before: (c) => c.closeViews(),
  },
  {
    id: "search",
    anchor: "search",
    eyebrow: { es: "Paso 1", en: "Step 1", pt: "Passo 1" },
    title: { es: "Busca un lugar", en: "Search for a place", pt: "Busque um lugar" },
    body: {
      es: "Escribe el nombre del sitio o el municipio. La búsqueda ocurre en tu teléfono: no registramos qué buscas ni quién lo busca.",
      en: "Type the name of a place or a municipality. The search happens on your phone: we don't record what you search for or who searched.",
      pt: "Digite o nome do lugar ou do município. A busca acontece no seu telefone: não registramos o que você busca nem quem buscou.",
    },
    hint: { es: "Tócalo y escribe algo.", en: "Tap it and type something.", pt: "Toque e digite algo." },
  },
  {
    id: "filters",
    anchor: "filters",
    eyebrow: { es: "Paso 2", en: "Step 2", pt: "Passo 2" },
    title: { es: "Acércate a tu zona", en: "Zoom to your area", pt: "Aproxime-se da sua área" },
    body: {
      es: "El primer desplegable acerca el mapa a una zona. El segundo abre la lista completa de puntos, agrupada por tipo y con buscador, por si vas directo a uno concreto.",
      en: "The first dropdown brings the map to an area. The second opens the full list of points, grouped by type and searchable, for when you are going straight to one.",
      pt: "O primeiro menu aproxima o mapa de uma área. O segundo abre a lista completa de pontos, agrupada por tipo e com busca, para quando você vai direto a um.",
    },
  },
  {
    id: "types",
    anchor: "types",
    eyebrow: { es: "Paso 3", en: "Step 3", pt: "Passo 3" },
    title: { es: "Muestra solo lo que buscas", en: "Show only what you need", pt: "Mostre só o que procura" },
    body: {
      es: "Cada tipo de punto tiene su color en el mapa: dónde dormir, dónde comer, dónde dejar o recibir donaciones, iniciativas de gente organizándose. Toca uno para ver solo ese; sin ninguno activo se ven todos.",
      en: "Each point type has its own colour on the map: where to sleep, where to eat, where to drop off or pick up donations, initiatives of people organising themselves. Tap one to see only that; with none active, all are shown.",
      pt: "Cada tipo de ponto tem sua cor no mapa: onde dormir, onde comer, onde deixar ou receber doações, iniciativas de pessoas se organizando. Toque em um para ver só ele; sem nenhum ativo, todos aparecem.",
    },
    hint: { es: "Toca un tipo para probar.", en: "Tap a type to try it.", pt: "Toque em um tipo para testar." },
  },
  {
    id: "sheet",
    anchor: "sheet",
    eyebrow: { es: "Paso 4", en: "Step 4", pt: "Passo 4" },
    title: { es: "La lista de abajo", en: "The list below", pt: "A lista abaixo" },
    body: {
      es: "Muestra los puntos que coinciden con lo que filtraste. Arrástrala hacia arriba para ver más, o pliégala con el botón de la esquina si quieres el mapa entero.",
      en: "It shows the points matching your filters. Drag it up to see more, or fold it with the corner button if you want the whole map.",
      pt: "Mostra os pontos que correspondem aos seus filtros. Arraste para cima para ver mais, ou recolha no botão do canto se quiser o mapa inteiro.",
    },
    before: (c) => {
      c.clearCenter();
      c.showSheet(true);
    },
  },
  {
    id: "refbar",
    anchor: "refbar",
    soft: true,
    eyebrow: { es: "Si quieres ayudar", en: "If you want to help", pt: "Se você quer ajudar" },
    title: { es: "Dónde hace falta ayuda", en: "Where help is needed", pt: "Onde falta ajuda" },
    body: {
      es: "Esta franja abre la lista de puntos que están pidiendo algo ahora mismo. Es el atajo para colaborar sin ir punto por punto: te dice qué falta y dónde.",
      en: "This strip opens the list of points asking for something right now. It is the shortcut to helping without going point by point: it tells you what is missing and where.",
      pt: "Esta faixa abre a lista de pontos que estão pedindo algo agora. É o atalho para colaborar sem ir ponto a ponto: mostra o que falta e onde.",
    },
  },
  {
    id: "ficha",
    anchor: "ficha",
    eyebrow: { es: "La ficha", en: "The card", pt: "A ficha" },
    title: { es: "Todo sobre un punto", en: "Everything about a point", pt: "Tudo sobre um ponto" },
    body: {
      es: "Qué necesita ahora, qué recibe, el horario, cómo llegar y a quién llamar. Arriba del todo, cuándo se actualizó por última vez.",
      en: "What it needs now, what it receives, its hours, how to get there and who to call. Right at the top, when it was last updated.",
      pt: "O que precisa agora, o que recebe, o horário, como chegar e para quem ligar. Bem no topo, quando foi atualizado pela última vez.",
    },
    bullets: [
      {
        es: "Verde abierto, ámbar lleno, rojo cerrado. Sin etiqueta significa que nadie lo ha confirmado, y no lo damos por abierto.",
        en: "Green open, amber full, red closed. No label means nobody has confirmed it, and we do not assume it is open.",
        pt: "Verde aberto, âmbar lotado, vermelho fechado. Sem etiqueta significa que ninguém confirmou, e não assumimos que está aberto.",
      },
      {
        es: "Si lleva días sin confirmarse, te lo avisamos: llama antes de trasladarte.",
        en: "If it has gone days without confirmation, we say so: call before you travel.",
        pt: "Se passou dias sem confirmação, avisamos: ligue antes de se deslocar.",
      },
      {
        es: "Puedes compartirla por WhatsApp o Telegram, o generar una imagen para redes con la necesidad y la fecha dentro.",
        en: "You can share it over WhatsApp or Telegram, or generate a social image with the need and the date inside it.",
        pt: "Você pode compartilhar por WhatsApp ou Telegram, ou gerar uma imagem para redes com a necessidade e a data dentro.",
      },
    ],
    before: (c) => c.openSample(),
    after: (c) => c.closeViews(),
  },
  {
    id: "fab",
    anchor: "fab",
    eyebrow: { es: "Colaborar", en: "Contribute", pt: "Colaborar" },
    title: { es: "Falta algo en el mapa", en: "Something is missing", pt: "Falta algo no mapa" },
    body: {
      es: "Desde aquí puedes contarnos de un punto que no aparece o registrar tu propia iniciativa, y también sumarte al equipo si tienes información de primera mano y puedes mantenerla al día.",
      en: "From here you can tell us about a point that is not listed or register your own initiative, and also join the team if you have first-hand information and can keep it current.",
      pt: "Daqui você pode nos contar sobre um ponto que não aparece ou registrar sua própria iniciativa, e também se juntar à equipe se tiver informação em primeira mão e puder mantê-la atualizada.",
    },
    hint: {
      es: "Ábrelo para ver las dos opciones.",
      en: "Open it to see both options.",
      pt: "Abra para ver as duas opções.",
    },
    before: (c) => c.closeViews(),
    after: (c) => c.setFabOpen(false),
  },
  {
    id: "review",
    eyebrow: { es: "Cómo se revisa", en: "How it is reviewed", pt: "Como é revisado" },
    title: { es: "Nada se publica solo", en: "Nothing publishes itself", pt: "Nada se publica sozinho" },
    body: {
      es: "Lo que envías entra en una cola que solo puede leer el equipo, y una persona lo confirma antes de que aparezca en el mapa. Esa demora es a propósito: es lo que separa un mapa en el que se puede confiar de un tablón de anuncios.",
      en: "What you send enters a queue only the team can read, and a person confirms it before it appears on the map. That delay is on purpose: it is what separates a map people can trust from a noticeboard.",
      pt: "O que você envia entra numa fila que só a equipe pode ler, e uma pessoa confirma antes de aparecer no mapa. Essa demora é proposital: é o que separa um mapa confiável de um mural de avisos.",
    },
  },
  {
    id: "datos",
    eyebrow: { es: "Tus datos", en: "Your data", pt: "Seus dados" },
    title: { es: "Los lugares circulan, las personas se protegen", en: "Places travel, people are protected", pt: "Os lugares circulam, as pessoas são protegidas" },
    body: {
      es: "La dirección y las necesidades de un punto están para compartirse lo más lejos posible. Los datos de una persona, no: cuando hace falta identificar a alguien afectado se publica lo mínimo para que su familia lo reconozca, y nada más. Tu contacto, si nos escribes, no se publica nunca.",
      en: "A point's address and needs exist to travel as far as possible. A person's data does not: when an affected person has to be identified, only the minimum for their family to recognise them is published, and nothing else. Your contact, if you write to us, is never published.",
      pt: "O endereço e as necessidades de um ponto existem para circular o mais longe possível. Os dados de uma pessoa, não: quando é preciso identificar alguém afetado, publica-se o mínimo para que sua família o reconheça, e nada mais. Seu contato, se você nos escrever, nunca é publicado.",
    },
    docs: "/docs/datos",
  },
  {
    id: "offline",
    eyebrow: { es: "Sin señal", en: "No signal", pt: "Sem sinal" },
    title: { es: "Sigue funcionando", en: "It keeps working", pt: "Continua funcionando" },
    body: {
      es: "Guardamos en tu teléfono lo último que cargaste, así que el mapa abre aunque te quedes sin datos y te avisamos de que puede estar desactualizado. Si envías algo y se cae la conexión, sale solo cuando vuelve la señal.",
      en: "We keep the last data you loaded on your phone, so the map opens even with no connection and we warn you it may be out of date. If you send something and the connection drops, it goes out on its own when the signal returns.",
      pt: "Guardamos no seu telefone os últimos dados carregados, então o mapa abre mesmo sem conexão e avisamos que pode estar desatualizado. Se você enviar algo e a conexão cair, ele sai sozinho quando o sinal voltar.",
    },
  },
  {
    id: "help",
    anchor: "help",
    eyebrow: { es: "Listo", en: "Done", pt: "Pronto" },
    title: { es: "Puedes volver a ver esto", en: "You can see this again", pt: "Você pode ver isto de novo" },
    body: {
      es: "Este botón reabre el recorrido cuando quieras. Y en la documentación está la guía completa, con todo lo que no cabe aquí.",
      en: "This button reopens the tour whenever you want. And the documentation has the full guide, with everything that does not fit here.",
      pt: "Este botão reabre o tour quando quiser. E a documentação tem o guia completo, com tudo o que não cabe aqui.",
    },
    docs: "/docs/guia",
  },
];

export const STAFF_STEPS: TourStep[] = [
  {
    id: "staff-welcome",
    eyebrow: { es: "Eres parte del equipo", en: "You are part of the team", pt: "Você faz parte da equipe" },
    title: { es: "Bienvenido", en: "Welcome", pt: "Bem-vindo" },
    body: {
      es: "Gracias por sostener esto. Tienes acceso de confianza: lo que publiques se ve de inmediato en el mapa público, sin cola de revisión. Por eso te pedimos leer esto antes de tu primer registro. El acceso es revocable en cualquier momento.",
      en: "Thank you for holding this up. You have trusted access: what you publish appears on the public map immediately, with no review queue. That is why we ask you to read this before your first entry. Access is revocable at any time.",
      pt: "Obrigado por sustentar isto. Você tem acesso de confiança: o que publicar aparece imediatamente no mapa público, sem fila de revisão. Por isso pedimos que leia isto antes do seu primeiro registro. O acesso é revogável a qualquer momento.",
    },
    before: (c) => c.openAdmin(),
  },
  {
    id: "staff-tabs",
    anchor: "admtabs",
    soft: true,
    eyebrow: { es: "El panel", en: "The panel", pt: "O painel" },
    title: { es: "Qué hay en cada pestaña", en: "What is in each tab", pt: "O que há em cada aba" },
    body: {
      es: "Novedades te dice qué cambió y qué está pendiente. Puntos es donde publicas y editas. Sugerencias son los aportes del público esperando confirmación. Solicitudes son quienes piden sumarse.",
      en: "Activity tells you what changed and what is pending. Points is where you publish and edit. Suggestions are public contributions waiting for confirmation. Requests are people asking to join.",
      pt: "Novidades mostra o que mudou e o que está pendente. Pontos é onde você publica e edita. Sugestões são contribuições do público aguardando confirmação. Solicitações são quem pede para entrar.",
    },
  },
  {
    id: "staff-point",
    eyebrow: { es: "Publicar un punto", en: "Publishing a point", pt: "Publicar um ponto" },
    title: { es: "El pin es lo que importa", en: "The pin is what matters", pt: "O pin é o que importa" },
    body: {
      es: "Que el nombre esté algo mal es una molestia; que el pin esté mal manda a alguien al otro lado de la ciudad. Usa «Buscar dirección» para rellenar las coordenadas y verifica el pin en el mapa antes de guardar. Siempre.",
      en: "A slightly wrong name is an inconvenience; a wrong pin sends someone across the city. Use “Find address” to fill the coordinates and verify the pin on the map before saving. Always.",
      pt: "Um nome levemente errado é um incômodo; um pin errado manda alguém para o outro lado da cidade. Use “Buscar endereço” para preencher as coordenadas e verifique o pin no mapa antes de salvar. Sempre.",
    },
  },
  {
    id: "staff-status",
    eyebrow: { es: "Necesidades", en: "Needs", pt: "Necessidades" },
    title: { es: "Concreto y fechado", en: "Concrete and dated", pt: "Concreto e datado" },
    body: {
      es: "Escribe la necesidad como te la dijeron: «agua y colchonetas» sirve, «insumos» no. Y marca el estado solo cuando lo sepas: dejarlo sin dato es una respuesta honesta, marcar «abierto» por inercia un punto que cerró es el peor error posible aquí.",
      en: "Write the need as it was told to you: “water and mattresses” works, “supplies” does not. And set the status only when you know: leaving it blank is an honest answer, marking a closed point “open” out of habit is the worst mistake possible here.",
      pt: "Escreva a necessidade como lhe foi dita: “água e colchões” serve, “insumos” não. E marque o status só quando souber: deixar em branco é uma resposta honesta, marcar “aberto” por inércia um ponto que fechou é o pior erro possível aqui.",
    },
  },
  {
    id: "staff-suggestions",
    eyebrow: { es: "Sugerencias", en: "Suggestions", pt: "Sugestões" },
    title: { es: "Confirma antes de publicar", en: "Confirm before publishing", pt: "Confirme antes de publicar" },
    body: {
      es: "Llegan de cualquiera y nadie fuera del equipo puede leerlas. Llama antes de publicarlas, y márcalas revisadas aunque decidas no publicarlas: así el resto del equipo no las vuelve a trabajar.",
      en: "They come from anyone and nobody outside the team can read them. Call before publishing, and mark them reviewed even when you decide not to publish: that way nobody on the team works them twice.",
      pt: "Chegam de qualquer pessoa e ninguém fora da equipe pode lê-las. Ligue antes de publicar, e marque como revisadas mesmo que decida não publicar: assim ninguém da equipe trabalha nelas duas vezes.",
    },
  },
  {
    id: "staff-rules",
    eyebrow: { es: "Reglas", en: "Rules", pt: "Regras" },
    title: { es: "Lo que no se rompe", en: "What does not bend", pt: "O que não se quebra" },
    body: {
      es: "Todo lo demás se puede corregir. Esto no.",
      en: "Everything else can be fixed. These cannot.",
      pt: "Todo o resto pode ser corrigido. Isto não.",
    },
    bullets: [
      {
        es: "De una persona afectada se publica lo mínimo para que su familia la reconozca. Ni domicilio, ni estado clínico, ni su contacto.",
        en: "Of an affected person, only the minimum for their family to recognise them is published. No home address, no clinical status, no contact details.",
        pt: "De uma pessoa afetada publica-se o mínimo para que sua família a reconheça. Sem endereço, sem estado clínico, sem contato.",
      },
      {
        es: "Menores de edad: sin documento y sin fotografía, sin excepciones.",
        en: "Minors: no identity document and no photograph, no exceptions.",
        pt: "Menores de idade: sem documento e sem fotografia, sem exceções.",
      },
      {
        es: "Un fallecimiento no se publica hasta estar confirmado.",
        en: "A death is not published until it is confirmed.",
        pt: "Um falecimento não se publica até estar confirmado.",
      },
      {
        es: "El contacto de quien reporta algo no se publica jamás.",
        en: "The contact of whoever reports something is never published.",
        pt: "O contato de quem reporta algo nunca é publicado.",
      },
      {
        es: "Borrar un punto es de administradores: para quien lo buscaba, un punto que desaparece es igual que un lugar que cerró.",
        en: "Deleting a point is for administrators: to whoever was looking for it, a point that vanishes is the same as a place that closed.",
        pt: "Excluir um ponto é de administradores: para quem o procurava, um ponto que desaparece é igual a um lugar que fechou.",
      },
    ],
    docs: "/docs/manual-voluntario",
  },
  {
    id: "staff-log",
    eyebrow: { es: "Bitácora", en: "Log", pt: "Registro" },
    title: { es: "Todo queda registrado", en: "Everything is logged", pt: "Tudo fica registrado" },
    body: {
      es: "Cada cambio se guarda con quién lo hizo y cuándo. No es vigilancia: es lo que permite deshacer un error rápido y lo que hace posible confiar en un equipo que publica sin revisión previa.",
      en: "Every change is stored with who made it and when. It is not surveillance: it is what lets a mistake be undone fast, and what makes it possible to trust a team that publishes without prior review.",
      pt: "Cada mudança é salva com quem a fez e quando. Não é vigilância: é o que permite desfazer um erro rápido e o que torna possível confiar numa equipe que publica sem revisão prévia.",
    },
  },
];
