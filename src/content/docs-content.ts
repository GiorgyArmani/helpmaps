import type { LS } from "@/content/roadmap";

// Long-form documentation, rendered by app/docs/[slug]/page.tsx.
//
// This is TEMPLATE content. It describes what HelpMaps is and does, in terms that hold
// in any country: people looking for help, and people offering it. It deliberately does
// NOT describe one emergency, one government or one country's paperwork — a clone edits
// this file to match its own operation, and until it does, everything here is still true.
//
// Use the tokens from `roadmap.ts` instead of naming things: {app}, {country}, {host},
// {region}, {regions}, {email}. They are resolved at render time from `config/`.
//
// Two rules for anything written here:
//   • Never promise more than the data supports. "Actualizado hace 3 días" is a fact;
//     "información confirmada" about a point nobody has called in a week is not.
//   • When people are involved, say plainly what is published and what never is. That
//     section is not boilerplate: it is the reason someone decides to trust the map.

export interface DocBlock {
  label?: LS;
  text?: LS;
  bullets?: LS[];
  link?: { href: string; label: LS };
  links?: { href: string; label: LS }[];
}

export interface DocSection {
  heading: LS;
  blocks: DocBlock[];
}

export interface DocPage {
  slug: string;
  title: LS;
  intro: LS;
  sections: DocSection[];
}

export const DOCS: DocPage[] = [
  // ------------------------------------------------------------------ Guía de uso
  {
    slug: "guia",
    title: { es: "Guía de uso", en: "Usage guide" },
    intro: {
      es: "{app} sirve para dos cosas: encontrar ayuda y ofrecerla. No hace falta leer esto entero. Con los dos primeros apartados ya puedes usar el mapa; el resto está aquí para cuando lo necesites.",
      en: "{app} does two things: it helps you find help, and it helps you offer it. You don't need to read all of this. The first two sections are enough to use the map; the rest is here for when you need it.",
    },
    sections: [
      {
        heading: { es: "Lo esencial en un minuto", en: "The essentials in one minute" },
        blocks: [
          {
            text: {
              es: "El mapa muestra puntos de ayuda: refugios, puntos de acopio, comedores e iniciativas ciudadanas. Cada punto dice qué recibe y qué necesita ahora mismo.",
              en: "The map shows help points: shelters, donation points, community kitchens and civic initiatives. Each point says what it receives and what it needs right now.",
            },
          },
          {
            bullets: [
              {
                es: "Busca por nombre o por municipio en la barra de arriba.",
                en: "Search by name or municipality in the bar at the top.",
              },
              {
                es: "Toca un punto en el mapa, o en la lista de abajo, para ver su ficha completa.",
                en: "Tap a point on the map, or in the list below, to see its full card.",
              },
              {
                es: "En la ficha tienes cómo llegar, el teléfono y el WhatsApp cuando el punto los tiene.",
                en: "The card has directions, the phone number and WhatsApp when the point has them.",
              },
              {
                es: "La franja «necesitan ayuda» abre la lista de puntos que están pidiendo algo hoy.",
                en: "The “need help” strip opens the list of points asking for something today.",
              },
            ],
          },
          {
            label: { es: "Antes de trasladarte", en: "Before you travel" },
            text: {
              es: "Llama primero. La información la reportan los propios puntos y el equipo en terreno, y aunque está fechada, no garantiza cupo ni existencias. Si la ficha avisa de que nadie ha confirmado el punto en varios días, esa llamada es imprescindible.",
              en: "Call first. The information is reported by the points themselves and by the field team, and although it is dated, it does not guarantee space or supplies. If the card warns that nobody has confirmed the point in several days, that call is essential.",
            },
          },
        ],
      },
      {
        heading: { es: "Si necesitas ayuda", en: "If you need help" },
        blocks: [
          {
            text: {
              es: "Filtra por {region} para acercar el mapa a tu zona, y por tipo de punto para ver solo lo que buscas: un lugar donde dormir, un comedor, un sitio donde te den lo que te falta.",
              en: "Filter by {region} to bring the map to your area, and by point type to see only what you need: somewhere to sleep, a kitchen, a place that gives out what you are missing.",
            },
          },
          {
            label: { es: "El botón de ubicación", en: "The location button" },
            text: {
              es: "Centra el mapa donde estás. Tu ubicación se usa solo en tu teléfono para mover el mapa: no se envía ni se guarda.",
              en: "It centres the map where you are. Your location is used on your phone only, to move the map: it is never sent or stored.",
            },
          },
          {
            label: { es: "Estado del punto", en: "Point status" },
            text: {
              es: "Verde abierto, ámbar lleno, rojo cerrado. Si no hay etiqueta es que nadie lo ha confirmado y no lo damos por abierto: preferimos decir que no sabemos antes que mandarte a una puerta cerrada.",
              en: "Green open, amber full, red closed. No label means nobody has confirmed it and we do not assume it is open: we would rather say we don't know than send you to a locked door.",
            },
          },
        ],
      },
      {
        heading: { es: "Si quieres ayudar", en: "If you want to help" },
        blocks: [
          {
            text: {
              es: "La lista de necesidades es el atajo: te dice qué falta y dónde, sin que tengas que ir punto por punto. Cada ficha se puede compartir por WhatsApp, Telegram o enlace, y también generar una imagen para redes con la necesidad y la fecha dentro.",
              en: "The needs list is the shortcut: it tells you what is missing and where, without going point by point. Every card can be shared over WhatsApp, Telegram or a link, and can also generate a social image with the need and the date inside it.",
            },
          },
          {
            label: { es: "Formas de ayudar que no son dinero", en: "Ways to help that are not money" },
            text: {
              es: "Muchos puntos, sobre todo las iniciativas ciudadanas, piden voluntariado, oficios, donación en especie o simplemente difusión. Aparecen como etiquetas en su ficha.",
              en: "Many points, civic initiatives especially, ask for volunteering, trades, in-kind donations or simply for the word to be spread. They appear as tags on the card.",
            },
          },
          {
            label: { es: "Falta un punto en el mapa", en: "A point is missing from the map" },
            text: {
              es: "Cuéntanoslo desde el botón «Colaborar». Lo revisa una persona del equipo antes de publicarlo: no aparece en el mapa de inmediato, y esa demora es a propósito.",
              en: "Tell us from the “Contribute” button. A member of the team reviews it before publishing: it does not appear on the map right away, and that delay is on purpose.",
            },
          },
        ],
      },
      {
        heading: { es: "Sin conexión", en: "Without a connection" },
        blocks: [
          {
            text: {
              es: "La app guarda en tu teléfono lo último que cargó. Si te quedas sin señal, el mapa sigue abriendo con esos datos y te avisa arriba de que pueden estar desactualizados.",
              en: "The app keeps the last data it loaded on your phone. If you lose signal the map still opens with it, and warns you at the top that it may be out of date.",
            },
          },
          {
            text: {
              es: "Si envías algo y la conexión se cae a mitad, no se pierde: queda guardado y sale solo cuando vuelve la señal.",
              en: "If you send something and the connection drops halfway, it is not lost: it stays queued and goes out on its own when the signal returns.",
            },
          },
          {
            text: {
              es: "Puedes instalarla desde el menú del navegador («Añadir a pantalla de inicio»). Instalada abre más rápido y funciona sin datos.",
              en: "You can install it from your browser menu (“Add to home screen”). Installed, it opens faster and works with no data.",
            },
          },
        ],
      },
      {
        heading: { es: "Idioma", en: "Language" },
        blocks: [
          {
            text: {
              es: "El botón con la bandera cambia el idioma y recuerda tu elección. Si compartes un enlace, quien lo abra lo verá en el idioma de su navegador o en el que le añadas al enlace.",
              en: "The flag button changes the language and remembers your choice. If you share a link, whoever opens it sees it in their own language or in the one you add to the link.",
            },
          },
        ],
      },
      {
        heading: { es: "Qué hacemos con tus datos", en: "What we do with your data" },
        blocks: [
          {
            text: {
              es: "Lo que buscas no sale de tu teléfono: el filtrado ocurre en tu navegador y no registramos a quién ni qué buscas. Si nos escribes por el formulario, tu contacto sirve solo para confirmar el dato y no se publica nunca.",
              en: "What you search for never leaves your phone: filtering happens in your browser and we do not record who or what you look for. If you write to us through the form, your contact is used only to confirm the information and is never published.",
            },
            link: { href: "/docs/datos", label: { es: "Cómo cuidamos los datos", en: "How we protect data" } },
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------- Datos y protección
  {
    slug: "datos",
    title: { es: "Cómo cuidamos los datos", en: "How we protect data" },
    intro: {
      es: "Un mapa de emergencia maneja dos cosas muy distintas: lugares, que están para que circulen, y personas, que están para ser encontradas por quien las busca y por nadie más. Esta página explica cómo tratamos cada una.",
      en: "An emergency map handles two very different things: places, which exist to circulate, and people, who exist to be found by whoever is looking for them and by nobody else. This page explains how we treat each.",
    },
    sections: [
      {
        heading: { es: "Los lugares se publican", en: "Places are published" },
        blocks: [
          {
            text: {
              es: "Un refugio, un comedor, un punto de acopio o una iniciativa son información pública: su dirección, su horario, su contacto y lo que necesitan están para compartirse lo más lejos posible. Ahí no hay nada que proteger; al contrario, cuanto más circula, más ayuda llega.",
              en: "A shelter, a kitchen, a donation point or an initiative is public information: its address, hours, contact and needs are there to travel as far as possible. There is nothing to protect there; the wider it circulates, the more help arrives.",
            },
          },
        ],
      },
      {
        heading: { es: "Las personas se protegen", en: "People are protected" },
        blocks: [
          {
            text: {
              es: "En una emergencia hace falta identificar a personas afectadas: para que una familia sepa que su gente está viva y dónde encontrarla. Eso es lo que salva la angustia de miles de personas, y es también el dato más peligroso que puede manejar una plataforma como esta.",
              en: "In an emergency, affected people do need to be identified: so that a family knows their people are alive and where to find them. That is what ends the anguish of thousands, and it is also the most dangerous kind of data a platform like this can hold.",
            },
          },
          {
            label: { es: "La regla", en: "The rule" },
            text: {
              es: "Se publica lo mínimo para que quien busca reconozca a quien busca, y nada más. Un nombre y el lugar donde está bastan para reunir a una familia. El domicilio, el estado clínico, el motivo del ingreso o el contacto de esa persona no aportan nada a la búsqueda y sí sirven a quien quiera hacer daño: nunca son públicos.",
              en: "The minimum for someone searching to recognise the person they are searching for is published, and nothing else. A name and the place they are at is enough to reunite a family. Home address, clinical status, reason for admission or that person's contact details add nothing to the search and do serve anyone who wants to cause harm: they are never public.",
            },
          },
          {
            bullets: [
              {
                es: "Los menores de edad llevan protección reforzada: sin documento de identidad y sin fotografía, en todas las pantallas y en todas las salidas de datos.",
                en: "Minors carry reinforced protection: no identity document and no photograph, on every screen and in every data export.",
              },
              {
                es: "El fallecimiento de una persona no se publica hasta que está confirmado, y se muestra con el cuidado que merece.",
                en: "A death is not published until it is confirmed, and it is shown with the care it deserves.",
              },
              {
                es: "Quien reporta a una persona buscada deja un contacto que solo ve el equipo: un reporte es una pista para buscar, nunca una publicación.",
                en: "Whoever reports a missing person leaves a contact only the team sees: a report is a lead to follow, never a publication.",
              },
              {
                es: "Nadie puede descargar el listado completo de personas. La API pública publica lugares, no personas.",
                en: "Nobody can download the full list of people. The public API publishes places, not people.",
              },
            ],
          },
          {
            label: { es: "Dónde está esa protección", en: "Where that protection lives" },
            text: {
              es: "No en una promesa: en la base de datos. Los campos sensibles no salen de ella hacia la aplicación, y las reglas de acceso se comprueban del lado del servidor, no del navegador. Un error en la interfaz no puede filtrar lo que la base no entrega.",
              en: "Not in a promise: in the database. Sensitive fields never leave it towards the application, and access rules are enforced on the server, not in the browser. A mistake in the interface cannot leak what the database does not hand over.",
            },
          },
          {
            label: { es: "Nota para este despliegue", en: "Note for this deployment" },
            text: {
              es: "Las funciones de personas se activan país por país y solo donde exista una red que confirme cada dato. Si en {country} todavía no están activas, es porque publicar una lista de personas sin quien la verifique hace más daño que bien.",
              en: "The people features are switched on country by country, and only where a network exists to confirm every record. If they are not active in {country} yet, it is because publishing a list of people with nobody verifying it does more harm than good.",
            },
          },
        ],
      },
      {
        heading: { es: "De dónde sale la información", en: "Where the information comes from" },
        blocks: [
          {
            bullets: [
              {
                es: "Del propio punto: quien coordina un refugio o un acopio dice qué recibe y qué le falta.",
                en: "From the point itself: whoever runs a shelter or a donation point says what it receives and what it lacks.",
              },
              {
                es: "Del equipo en terreno, que confirma por teléfono o en persona.",
                en: "From the field team, confirming by phone or in person.",
              },
              {
                es: "Del público, a través del formulario. Esas sugerencias no se publican solas: entran en una cola que solo el equipo puede leer, y una persona las confirma antes de que aparezcan.",
                en: "From the public, through the form. Those suggestions do not publish themselves: they enter a queue only the team can read, and a person confirms them before they appear.",
              },
            ],
          },
          {
            label: { es: "Por qué verás fechas por todas partes", en: "Why you will see dates everywhere" },
            text: {
              es: "Porque un dato de hace tres semanas es una suposición, no información. Cada ficha dice cuándo se actualizó y avisa cuando lleva demasiado sin confirmarse. Preferimos que dudes de un dato viejo a que confíes en él.",
              en: "Because three-week-old data is a guess, not information. Every card says when it was updated and warns when it has gone too long without confirmation. We would rather you doubted an old record than trusted it.",
            },
          },
        ],
      },
      {
        heading: { es: "Quién puede cambiar el mapa", en: "Who can change the map" },
        blocks: [
          {
            text: {
              es: "Un equipo verificado. Publican en vivo, sin cola de revisión, porque en una emergencia esperar cuesta horas que no existen. Lo que sostiene esa confianza es que el acceso se revoca al instante y que cada cambio queda registrado con su autor y su hora.",
              en: "A vetted team. They publish live, with no review queue, because in an emergency waiting costs hours that do not exist. What holds that trust up is that access is revoked instantly and every change is logged with its author and time.",
            },
          },
          {
            text: {
              es: "Borrar un punto queda reservado a los administradores: para una familia que lo estaba buscando, un punto que desaparece del mapa es indistinguible de un lugar que cerró.",
              en: "Deleting a point is reserved for administrators: to a family that was looking for it, a point vanishing from the map is indistinguishable from a place that closed.",
            },
          },
        ],
      },
      {
        heading: { es: "Tus derechos", en: "Your rights" },
        blocks: [
          {
            text: {
              es: "Puedes pedir acceso, corrección o eliminación de tus datos, y que retiremos un punto que hayas reportado. Escríbenos a {email} y respondemos por el mismo medio. Si ves algo publicado que no debería estar, decírnoslo es lo más urgente que hay en esta página.",
              en: "You can request access, correction or deletion of your data, and ask us to take down a point you reported. Write to {email} and we answer by the same channel. If you see something published that should not be, telling us is the most urgent thing on this page.",
            },
            link: { href: "/docs/privacidad", label: { es: "Política de privacidad", en: "Privacy policy" } },
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------- Manual del equipo
  {
    slug: "manual-voluntario",
    title: { es: "Manual del equipo", en: "Team manual" },
    intro: {
      es: "Para quien tiene acceso al panel. Lo que publiques aparece de inmediato en el mapa público: no hay nadie revisando detrás de ti. Léelo antes del primer registro.",
      en: "For anyone with panel access. What you publish appears on the public map immediately: there is nobody reviewing behind you. Read this before your first entry.",
    },
    sections: [
      {
        heading: { es: "Entrar", en: "Signing in" },
        blocks: [
          {
            text: {
              es: "Entra en {host}/login con tu correo y tu contraseña. Una vez dentro, el engranaje de la cabecera abre el panel. Si algo no te aparece, es que tu rol no lo incluye: hay acciones reservadas a administradores.",
              en: "Go to {host}/login with your email and password. Once inside, the gear in the header opens the panel. If something is not there, your role does not include it: some actions are reserved for administrators.",
            },
          },
        ],
      },
      {
        heading: { es: "Publicas en vivo", en: "You publish live" },
        blocks: [
          {
            text: {
              es: "No hay cola de revisión delante de ti, y es deliberado: esperar una autorización cuesta horas que en una emergencia no existen. A cambio, dos cosas: tu acceso se puede revocar al instante, y cada cambio queda en la bitácora con tu nombre y la hora.",
              en: "There is no review queue in front of you, and that is deliberate: waiting for authorisation costs hours an emergency does not have. In exchange, two things: your access can be revoked instantly, and every change is logged with your name and the time.",
            },
          },
        ],
      },
      {
        heading: { es: "Puntos", en: "Points" },
        blocks: [
          {
            text: {
              es: "La pestaña de puntos lista todo lo publicado y permite crear uno nuevo. El campo que de verdad importa son las coordenadas: que el nombre esté algo mal es una molestia, que el pin esté mal manda a alguien al otro lado de la ciudad.",
              en: "The points tab lists everything published and lets you create a new one. The field that really matters is the coordinates: a slightly wrong name is an inconvenience, a wrong pin sends someone across the city.",
            },
          },
          {
            bullets: [
              {
                es: "Usa «Buscar dirección» y elige el resultado: rellena coordenadas, municipio y {region} de una vez.",
                en: "Use “Find address” and pick a result: it fills coordinates, municipality and {region} in one go.",
              },
              {
                es: "Verifica el pin en el mapa antes de guardar. Siempre.",
                en: "Verify the pin on the map before saving. Always.",
              },
              {
                es: "«Visible en el mapa» apagado esconde el punto sin borrarlo: úsalo para lo que dejó de operar pero puede volver.",
                en: "Turning off “Visible on the map” hides a point without deleting it: use it for something that stopped operating but may come back.",
              },
            ],
          },
        ],
      },
      {
        heading: { es: "Necesidades y estado", en: "Needs and status" },
        blocks: [
          {
            text: {
              es: "Es la parte que la gente consulta antes de moverse, y la que caduca más rápido. Escribe la necesidad como te la dijeron, concreta: «agua y colchonetas» sirve, «insumos» no.",
              en: "This is what people check before travelling, and what goes stale fastest. Write the need as it was told to you, concrete: “water and mattresses” works, “supplies” does not.",
            },
          },
          {
            label: { es: "El estado del punto", en: "The point's status" },
            text: {
              es: "Marca abierto, lleno o cerrado solo cuando lo sepas. Dejarlo sin dato es una respuesta válida y honesta; marcar «abierto» por inercia un punto que cerró es el peor error que se puede cometer aquí. Marcarlo cuenta como confirmación y actualiza la fecha.",
              en: "Mark open, full or closed only when you know. Leaving it blank is a valid and honest answer; marking a closed point “open” out of habit is the worst mistake you can make here. Marking it counts as a confirmation and updates the date.",
            },
          },
          {
            text: {
              es: "El botón «Abierto» de la lista confirma un punto de un toque, sin abrir el formulario. Úsalo después de cada ronda de llamadas.",
              en: "The “Open” button in the list confirms a point in one tap, without opening the form. Use it after each round of calls.",
            },
          },
        ],
      },
      {
        heading: { es: "Sugerencias del público", en: "Public suggestions" },
        blocks: [
          {
            text: {
              es: "Llegan de cualquiera y nadie fuera del equipo puede leerlas. Confirma por teléfono antes de publicar: es la diferencia entre un mapa en el que se puede confiar y un tablón de anuncios. Marca revisado cuando la hayas atendido, aunque decidas no publicarla.",
              en: "They come from anyone and nobody outside the team can read them. Confirm by phone before publishing: that is the difference between a map people can trust and a noticeboard. Mark it reviewed once you have handled it, even if you decide not to publish.",
            },
          },
        ],
      },
      {
        heading: { es: "Reglas que no se rompen", en: "Rules that do not bend" },
        blocks: [
          {
            bullets: [
              {
                es: "Datos de personas: solo lo mínimo para que su familia la reconozca. Ni domicilio, ni estado clínico, ni contacto.",
                en: "People's data: only the minimum for their family to recognise them. No home address, no clinical status, no contact details.",
              },
              {
                es: "Menores de edad: sin documento y sin fotografía, sin excepciones.",
                en: "Minors: no identity document and no photograph, no exceptions.",
              },
              {
                es: "Un fallecimiento no se publica hasta estar confirmado.",
                en: "A death is not published until it is confirmed.",
              },
              {
                es: "El contacto de quien reporta algo no se publica jamás.",
                en: "The contact details of whoever reports something are never published.",
              },
              {
                es: "No pegues datos personales reales en capturas, mensajes ni tickets.",
                en: "Never paste real personal data into screenshots, messages or tickets.",
              },
            ],
          },
        ],
      },
      {
        heading: { es: "Trabajar sin señal", en: "Working without signal" },
        blocks: [
          {
            text: {
              es: "El panel necesita conexión para guardar. Si estás en terreno sin señal, anota y carga al volver; lo que envíes desde los formularios públicos sí queda en cola y sale solo cuando hay red.",
              en: "The panel needs a connection to save. If you are in the field with no signal, write it down and load it when you are back; anything sent from the public forms does queue and goes out on its own when the network returns.",
            },
          },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------------- Colabora
  {
    slug: "colabora",
    title: { es: "Colabora, financia y despliega", en: "Collaborate, fund and deploy" },
    intro: {
      es: "{app} es parte de {platform}, una plataforma cívica abierta para emergencias. No cobra a quien la usa y no vende datos. Se sostiene con trabajo voluntario, aliados y financiación.",
      en: "{app} is part of {platform}, an open civic platform for emergencies. It never charges the people who use it and never sells data. It runs on volunteer work, allies and funding.",
    },
    sections: [
      {
        heading: { es: "Traerlo a tu país", en: "Bringing it to your country" },
        blocks: [
          {
            text: {
              es: "El repositorio es la base y se clona por país: se ajusta un archivo de configuración con las regiones, la marca y el idioma, se crea su propia base de datos y queda desplegado en su subdominio. La parte técnica se resuelve en una tarde.",
              en: "The repository is the base and is cloned per country: adjust one configuration folder with the regions, the brand and the language, create its own database, and it is deployed on its subdomain. The technical part takes an afternoon.",
            },
            link: { href: "/docs/desplegar", label: { es: "Cómo desplegarlo", en: "How to deploy it" } },
          },
          {
            label: { es: "Lo que de verdad hace falta", en: "What is actually needed" },
            text: {
              es: "Un equipo local que verifique los puntos, datos con los que empezar en una zona bien cubierta, y alguien que responda legalmente por esos datos en ese país. Sin eso, el mapa envejece en días y empieza a mandar gente a lugares que ya cerraron.",
              en: "A local team to verify the points, enough data to start with one area well covered, and someone who answers legally for that data in that country. Without those, the map ages in days and starts sending people to places that have closed.",
            },
          },
        ],
      },
      {
        heading: { es: "Financiación y alianzas", en: "Funding and partnerships" },
        blocks: [
          {
            bullets: [
              {
                es: "Subvenciones y fondos institucionales de respuesta a emergencias.",
                en: "Grants and institutional emergency-response funding.",
              },
              {
                es: "Aportes en especie: conectividad, alojamiento, redes logísticas, difusión.",
                en: "In-kind support: connectivity, hosting, logistics networks, outreach.",
              },
              {
                es: "Organizaciones locales que aporten datos verificados o los consuman desde la API pública.",
                en: "Local organisations contributing verified data or consuming it through the public API.",
              },
            ],
          },
          {
            text: {
              es: "Escríbenos a {email}.",
              en: "Write to us at {email}.",
            },
          },
        ],
      },
      {
        heading: { es: "Contribuir al código", en: "Contributing code" },
        blocks: [
          {
            text: {
              es: "Es un proyecto abierto: lo que entra en el repositorio base baja a todos los despliegues. Los datos publicados se ofrecen bajo CC BY 4.0 y la cartografía base es de OpenStreetMap.",
              en: "It is an open project: what lands in the base repository reaches every deployment. Published data is offered under CC BY 4.0 and the base map comes from OpenStreetMap.",
            },
            link: { href: "/docs/api", label: { es: "API pública", en: "Public API" } },
          },
        ],
      },
    ],
  },

  // ------------------------------------------------------------------------ Prensa
  {
    slug: "prensa",
    title: { es: "Para prensa", en: "For press" },
    intro: {
      es: "Qué es {app}, qué puede afirmarse de sus datos y qué no.",
      en: "What {app} is, what can be claimed about its data and what cannot.",
    },
    sections: [
      {
        heading: { es: "En una línea", en: "In one line" },
        blocks: [
          {
            text: {
              es: "Un mapa abierto donde quien necesita ayuda encuentra dónde conseguirla y quien quiere ayudar ve qué hace falta y dónde, desplegable en cualquier país.",
              en: "An open map where whoever needs help finds where to get it and whoever wants to help sees what is needed and where, deployable in any country.",
            },
          },
        ],
      },
      {
        heading: { es: "Qué se puede afirmar", en: "What can be claimed" },
        blocks: [
          {
            bullets: [
              {
                es: "Los puntos publicados están confirmados por el equipo o reportados por el propio punto, y cada ficha lleva su fecha.",
                en: "Published points are confirmed by the team or reported by the point itself, and every card carries its date.",
              },
              {
                es: "Las cifras del mapa son de puntos publicados, no una medida del alcance de la emergencia.",
                en: "The map's figures count published points; they are not a measure of the scale of the emergency.",
              },
              {
                es: "La plataforma no publica datos personales sensibles ni permite descargar listados de personas.",
                en: "The platform publishes no sensitive personal data and allows no download of lists of people.",
              },
            ],
          },
        ],
      },
      {
        heading: { es: "Contacto", en: "Contact" },
        blocks: [
          {
            text: { es: "{email}", en: "{email}" },
            link: { href: "/docs/datos", label: { es: "Cómo cuidamos los datos", en: "How we protect data" } },
          },
        ],
      },
    ],
  },
];

export const getDoc = (slug: string) => DOCS.find((d) => d.slug === slug);
