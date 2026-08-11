// Diccionario base. Es el ÚNICO completo: `en` y `pt` son parciales y caen a este por
// clave, así que una traducción faltante muestra español real y no `center.needs.title`.
//
// No edites este archivo para localizar un despliegue: usa `config/language.ts`
// (overrides por clave), que sobrevive a los merges con el repo base.
//
// Tono: calmado y directo. Quien lee esto puede estar asustado, con poca batería y peor
// señal. Frases cortas, sin alarmismo, sin promesas que el dato no respalda.

const es = {
  // ── Común ───────────────────────────────────────────────────────────────
  "common.close": "Cerrar",
  "common.cancel": "Cancelar",
  "common.save": "Guardar",
  "common.saving": "Guardando…",
  "common.delete": "Eliminar",
  "common.edit": "Editar",
  "common.add": "Agregar",
  "common.back": "Volver",
  "common.search": "Buscar",
  "common.loading": "Cargando…",
  "common.retry": "Reintentar",
  "common.copy": "Copiar",
  "common.copied": "Copiado",
  "common.optional": "opcional",
  "common.required": "obligatorio",
  "common.unknown": "Sin dato",
  "common.yes": "Sí",
  "common.no": "No",
  "common.all": "Todos",
  "common.of": "de",

  "time.now": "hace un momento",
  "time.minutes": "hace {n} min",
  "time.hours": "hace {n} h",
  "time.days": "hace {n} días",
  "time.oneDay": "ayer",

  "error.generic": "Algo salió mal. Intenta de nuevo.",
  "error.network": "Sin conexión. Revisa tu señal e intenta otra vez.",
  "error.notFound": "No encontramos lo que buscas.",
  "error.notConfigured":
    "Este despliegue todavía no tiene su base de datos configurada. Revisa las variables de entorno.",

  // ── Mapa y filtros ──────────────────────────────────────────────────────
  "map.searchPlaceholder": "Buscar por nombre o municipio",
  "map.allRegions": "Todos los {regions}",
  "map.allCenters": "Todos los puntos",
  "map.centerSearch": "Buscar un punto",
  "map.help": "Cómo funciona",
  "map.fold": "Plegar la lista",
  "map.unfold": "Ver la lista",
  "map.region": "{region}",
  "map.myLocation": "Mi ubicación",
  "map.locating": "Buscando tu ubicación…",
  "map.locationDenied": "No pudimos obtener tu ubicación. Revisa los permisos.",
  "map.pointsCount": "{n} puntos",
  "map.pointsCountOne": "1 punto",
  "map.noResults": "Ningún punto coincide con el filtro",
  "map.noResultsHint": "Prueba quitando filtros o buscando por otro nombre.",
  "map.legend": "Tipos de punto",
  "map.zoomIn": "Acercar",
  "map.zoomOut": "Alejar",

  // ── Tipos de punto ──────────────────────────────────────────────────────
  "type.shelter": "Refugio",
  "type.shelter.plural": "Refugios",
  "type.donation_centre": "Punto de acopio",
  "type.donation_centre.plural": "Puntos de acopio",
  "type.comedor": "Comedor",
  "type.comedor.plural": "Comedores",
  "type.iniciativa": "Iniciativa ciudadana",
  "type.iniciativa.plural": "Iniciativas ciudadanas",
  "type.hospital": "Hospital",
  "type.hospital.plural": "Hospitales",
  "type.morgue": "Morgue",
  "type.morgue.plural": "Morgues",

  // ── Estado del punto ────────────────────────────────────────────────────
  "status.abierto": "Abierto",
  "status.lleno": "Lleno",
  "status.cerrado": "Cerrado",
  "status.unknown": "Sin confirmar",
  "status.closedWarning": "Este punto está cerrado. No vayas sin llamar antes.",
  "status.fullWarning": "Este punto está lleno. Confirma antes de llevar donaciones.",
  "status.staleWarning":
    "Nadie confirma este punto desde hace {n} días. Llama antes de ir.",

  // ── Ficha del punto ─────────────────────────────────────────────────────
  "center.needsTitle": "Necesita ahora",
  "center.receivesTitle": "Recibe",
  "center.helpTitle": "Cómo ayudar",
  "center.scheduleTitle": "Horario",
  "center.contactTitle": "Contacto",
  "center.categoryTitle": "Tipo de iniciativa",
  "center.aboutTitle": "Sobre este punto",
  "center.directions": "Cómo llegar",
  "center.call": "Llamar",
  "center.whatsapp": "WhatsApp",
  "center.share": "Compartir",
  "center.shareNeed": "Compartir esta necesidad",
  "center.updated": "Actualizado {ago}",
  "center.updatedLabel": "Última actualización",
  "center.confirmedLabel": "Confirmado por última vez",
  "center.socialLink": "Ver su red social",
  "center.confirmed": "Confirmado {ago}",
  "center.neverConfirmed": "Sin confirmación reciente",
  "center.noNeeds": "Este punto no ha reportado necesidades.",
  "center.animal": "Rescate animal",
  "center.source": "Datos: {source}",
  "center.responsible": "Responsable",
  "center.disclaimer":
    "Esta información la reporta el propio punto o el equipo en terreno. No garantiza cupo ni disponibilidad: confirma por teléfono antes de trasladarte.",

  // ── Ayudas (no monetarias) ──────────────────────────────────────────────
  "help.voluntariado": "Voluntariado",
  "help.especie": "Donación en especie",
  "help.oficios": "Oficios y trabajo técnico",
  "help.difusion": "Difusión",
  "help.economico": "Aporte económico",

  // ── Lista de necesidades ────────────────────────────────────────────────
  "needs.barCount": "{n} puntos necesitan ayuda",
  "needs.barCountOne": "1 punto necesita ayuda",
  "needs.listTitle": "Dónde hace falta ayuda",
  "needs.listSubtitle": "Puntos que reportaron una necesidad. Colabora donde puedas.",
  "needs.empty": "Todavía ningún punto reportó necesidades.",
  "needs.emptyHint": "Si conoces uno, cuéntanos y lo publicamos.",

  // ── Compartir ───────────────────────────────────────────────────────────
  "share.title": "Compartir",
  "share.igTitle": "¿Para dónde es?",
  "share.igStory": "Historia · 9:16",
  "share.igPost": "Publicación · 4:5",
  "share.igSquare": "Cuadrado · 1:1",
  "share.image": "Imagen para redes",
  "share.building": "Generando la imagen…",
  "og.updatedToday": "Actualizado hoy",
  "og.updatedOneDay": "Actualizado hace 1 día",
  "og.updatedDays": "Actualizado hace {n} días",
  "og.needs": "NECESITA",
  "og.receives": "RECIBE",
  "og.helpPoint": "PUNTO DE AYUDA",
  "share.whatsapp": "WhatsApp",
  "share.telegram": "Telegram",
  "share.copyLink": "Copiar enlace",
  "share.linkCopied": "Enlace copiado",
  "share.needText": "{name} necesita: {needs}",
  "share.pointText": "{name} — {type} en {place}",

  // ── Sugerir un punto ────────────────────────────────────────────────────
  "fab.cta": "Colaborar",
  "sheet.point": "punto",
  "sheet.points": "puntos",
  "suggest.cta": "Falta un punto en el mapa",
  "suggest.ctaHint": "Cuéntanos de un refugio, comedor, acopio o iniciativa que no aparece.",
  "suggest.ctaInitiative": "Registrar mi iniciativa",
  "suggest.title": "Cuéntanos qué falta",
  "suggest.subtitle":
    "Lo revisa una persona del equipo antes de publicarlo. No aparece en el mapa de inmediato.",
  "suggest.kind": "¿Qué nos estás contando?",
  "suggest.kind.center": "Un punto que falta en el mapa",
  "suggest.kind.initiative": "Una iniciativa ciudadana",
  "suggest.kind.need": "Una necesidad de un punto que ya está",
  "suggest.kind.other": "Otra cosa",
  "suggest.message": "Cuéntanos",
  "suggest.messagePlaceholder":
    "Nombre del lugar, dirección o referencia, qué recibe y qué necesita ahora.",
  "suggest.name": "Tu nombre",
  "suggest.contact": "Tu contacto",
  "suggest.contactHint":
    "Correo o teléfono, por si necesitamos confirmar algo. No se publica.",
  "suggest.submit": "Enviar",
  "suggest.sending": "Enviando…",
  "suggest.done": "Recibido",
  "suggest.doneBody":
    "Gracias. El equipo lo revisa y, si se confirma, aparece en el mapa.",
  "suggest.error": "No pudimos enviarlo. Intenta de nuevo en un momento.",
  "suggest.tooMany": "Demasiados envíos seguidos. Espera un minuto e intenta otra vez.",

  // ── Sumarse al equipo ───────────────────────────────────────────────────
  "volunteer.cta": "Sumarme al equipo",
  "volunteer.ctaHint": "Si tienes información de primera mano y puedes mantenerla al día.",
  "volunteer.title": "Sumarme al equipo",
  "volunteer.subtitle":
    "Quien entra al panel publica en vivo sobre el mapa, así que cada solicitud la aprueba una persona.",
  "volunteer.name": "Nombre",
  "volunteer.email": "Correo",
  "volunteer.phone": "Teléfono",
  "volunteer.profile": "¿Qué haces?",
  "volunteer.profileHint": "Ej.: coordino un refugio, soy rescatista, manejo un comedor.",
  "volunteer.region": "¿Dónde?",
  "volunteer.motivation": "¿A qué información tienes acceso?",
  "volunteer.submit": "Enviar solicitud",
  "volunteer.done": "Solicitud enviada",
  "volunteer.doneBody":
    "Te escribimos al correo que dejaste cuando el equipo la revise.",

  // ── Privacidad en formularios ───────────────────────────────────────────
  "privacy.notice":
    "Lo que envíes lo revisa el equipo. Tu contacto no se publica y se usa solo para confirmar el dato.",
  "privacy.link": "Cómo tratamos tus datos",

  // ── Datos en caché / mantenimiento ──────────────────────────────────────
  "offline.stale": "Datos posiblemente desactualizados",
  "offline.staleHint": "Última carga: {ago}. Se actualizan solos cuando vuelva la señal.",
  "offline.offline": "Sin conexión",
  "offline.swBody": "No hay conexión y esta página todavía no está guardada. Abre el mapa al menos una vez con internet y quedará disponible sin señal.",
  "offline.queued": "Sin conexión: lo enviaremos solo cuando vuelva la señal.",
  "maintenance.default":
    "Estamos reverificando la información. Puede que veas menos puntos de lo normal.",

  // ── Entrada (/inicio) ───────────────────────────────────────────────────
  // La página del QR impreso: plantea la pregunta que reparte a quien llega
  // («¿necesitas ayuda o quieres ayudar?») y de ahí entra al mapa.
  "entry.titleNeed": "¿Necesitas ayuda?",
  "entry.titleGive": "¿Quieres ayudar?",
  "entry.lead":
    "{brand} es el lugar donde quien necesita ayuda y quien quiere ayudar se encuentran.",
  "entry.needHelp": "Necesito ayuda",
  "entry.needHelpDesc": "Encuentra refugios, comedores y puntos de acopio cerca de ti.",
  "entry.wantHelp": "Quiero ayudar",
  "entry.wantHelpDesc": "Mira qué hace falta y dónde, o registra tu iniciativa.",
  "entry.enter": "Entrar al mapa",
  "entry.statsTitle": "Lo que hay publicado hoy",
  "entry.statsNote": "Con lo que cada punto recibe, lo que necesita ahora y si sigue abierto.",
  "entry.campaignTag": "Campaña abierta",
  "entry.campaignTitle": "¿Tu iniciativa está ayudando? Ponla en el mapa",
  "entry.campaignBody":
    "Brigadas, comedores, puntos de agua, apoyo psicológico, rescate animal. Sin distinción política, social ni racial.",
  "entry.campaignCta": "Registrar mi iniciativa",
  "entry.campaignFine": "Es gratis y siempre lo será. Verificamos cada punto antes de publicarlo.",

  // ── Donaciones ──────────────────────────────────────────────────────────
  "donate.cta": "Donar",
  "donate.ctaHint": "Organizaciones que reciben aportes para esta emergencia.",
  "donate.title": "Donar",
  "donate.subtitle":
    "Organizaciones e iniciativas que reciben aportes. Cada una enlaza su red o su web: revísala antes de donar.",
  "donate.none": "Todavía no hay ninguna organización publicada.",
  "donate.data": "Datos para donar",
  "donate.follow": "Ver su red",
  "donate.go": "Donar",
  "donate.joinTitle": "¿Tu organización recibe donaciones?",
  "donate.joinBody":
    "Si puedes mostrar en qué se convierte lo que recibes, escríbenos y te sumamos a esta lista.",
  "donate.joinCta": "Escríbenos",
  "donate.note":
    "No recibimos ni administramos dinero. Esta lista solo dice quién lo hace y cómo comprobarlo.",

  // ── Escríbenos ──────────────────────────────────────────────────────────
  "contact.title": "Escríbenos",
  "contact.subDonation":
    "Cuéntanos qué organización son, qué hacen con lo que reciben y cómo puede comprobarlo quien done.",
  "contact.subGeneral": "Escribe al equipo que mantiene el mapa.",
  "contact.message": "Mensaje",
  "contact.messageHintDonation":
    "Nombre de la organización, qué hacen, dónde publican lo que reciben y los datos para donar.",
  "contact.name": "Tu nombre",
  "contact.email": "Tu correo",
  "contact.emailHint": "Para poder responderte. No se publica.",
  "contact.photos": "Imágenes",
  "contact.photosHint": "Hasta 4. Se comprimen antes de enviarse.",
  "contact.addPhoto": "Adjuntar imagen",
  "contact.photoError": "No pudimos procesar esa imagen. Prueba con otra.",
  "contact.submit": "Enviar",
  "contact.sending": "Enviando…",
  "contact.done": "Mensaje enviado",
  "contact.doneBody": "Lo leemos y te respondemos al correo que dejaste.",
  "contact.error": "No pudimos enviarlo. Intenta de nuevo en un momento.",
  "contact.tooMany": "Demasiados mensajes seguidos. Espera un minuto y vuelve a intentarlo.",

  // ── Sesión del equipo ───────────────────────────────────────────────────
  "login.title": "Entrar al panel",
  "login.subtitle": "Solo para el equipo. Si quieres sumarte, escríbenos desde el mapa.",
  "login.email": "Correo",
  "login.password": "Contraseña",
  "login.submit": "Entrar",
  "login.submitting": "Entrando…",
  "login.error": "Correo o contraseña incorrectos.",
  "login.signOut": "Salir",

  // ── Panel ───────────────────────────────────────────────────────────────
  "admin.title": "Panel del equipo",
  "admin.tab.activity": "Novedades",
  "admin.tab.centers": "Puntos",
  "admin.tab.submissions": "Sugerencias",
  "admin.tab.volunteers": "Solicitudes",
  "admin.liveNote":
    "Lo que publiques aparece de inmediato en el mapa público. El acceso es revocable y todo queda registrado.",
  "admin.newCenter": "Nuevo punto",
  "admin.searchCenters": "Buscar punto",
  "admin.noCenters": "Todavía no hay puntos publicados.",
  "admin.pending": "{n} pendientes",
  "admin.none": "Nada pendiente.",
  "admin.approve": "Aprobar",
  "admin.reject": "Rechazar",
  "admin.volApproved": "Aprobada. Le enviamos por correo el acceso y el manual.",
  // Con el correo caído (o en spam) esta es la única forma de que la persona entre: el
  // servidor devuelve la contraseña temporal justamente para poder pasarla a mano.
  "admin.volApprovedNoMail":
    "Aprobada, pero el correo no salió. Pásale por WhatsApp esta contraseña temporal y el enlace del manual: {p}",
  "admin.volRejected": "Solicitud descartada.",
  "admin.reviewed": "Revisado",
  "admin.confirmOpen": "Confirmar que sigue abierto",
  "admin.hidden": "oculto",
  "admin.systemActor": "Sistema",
  "admin.deleteConfirm":
    "¿Eliminar «{name}»? Se borra también su información de necesidades. No se puede deshacer.",
  "admin.adminOnly": "Solo un administrador puede hacer esto.",
  "admin.maintenance": "Modo mantenimiento",
  "admin.maintenanceHint":
    "Muestra un aviso en todo el sitio. La app sigue usable: es un aviso, no un bloqueo.",
  "admin.saved": "Guardado",
  "admin.saveError": "No se pudo guardar.",
  "admin.unknownRegion": "Región desconocida",
  "admin.unknownRegionHint":
    "Esta fila tiene una región que este país no define. Corrígela para que aparezca en el filtro.",

  // ── Formulario de punto ─────────────────────────────────────────────────
  "admin.tab.donations": "Donaciones",
  "admin.newDonation": "Agregar organización",
  "admin.noDonations": "Todavía no hay ninguna organización publicada.",
  "form.donateWarning":
    "Publicar aquí es decirle a la gente que puede mandar dinero a este destino. Verifica la organización y copia los datos con cuidado.",
  "form.socialUrlHintDonation": "Es lo que le permite a quien dona comprobar que existe.",
  "form.donateUrl": "Enlace para donar",
  "form.donateInfo": "Datos para recibir aportes",
  "form.donateInfoHint": "Cuenta, pago móvil, Zelle… Tal cual, para copiar y pegar.",
  "form.sort": "Orden",
  "form.sortHint": "Menor primero. Con el mismo número se ordena por nombre.",
  "form.activeDonation": "Visible en la lista de donaciones",
  "form.name": "Nombre",
  "form.type": "Tipo",
  "form.region": "Región",
  "form.municipality": "Municipio",
  "form.address": "Dirección o referencia",
  "form.coords": "Coordenadas",
  "form.lat": "Latitud",
  "form.lng": "Longitud",
  "form.findAddress": "Buscar dirección",
  "form.findAddressHint":
    "Pega un enlace de Google Maps (o unas coordenadas) y el pin se pone solo. Si lo dejas vacío, busca por el nombre del punto.",
  "form.findAddressPlaceholder": "Nombre del lugar, dirección o enlace de Maps",
  "form.searching": "Buscando…",
  "form.noGeoResults": "Sin resultados. Ajusta la dirección o pon las coordenadas a mano.",
  "form.pinWarning":
    "Verifica el pin en el mapa antes de guardar. Un pin equivocado manda gente al lugar equivocado.",
  "form.phone": "Teléfono",
  "form.whatsapp": "WhatsApp",
  "form.active": "Visible en el mapa",
  "form.needsSection": "Necesidades del punto",
  "form.status": "Estado del punto",
  "form.needs": "¿Qué necesita ahora?",
  "form.receives": "¿Qué recibe?",
  "form.receivesHint": "Separa con comas: agua, ropa, medicinas.",
  "form.help": "Formas de ayudar",
  "form.category": "Categoría",
  "form.description": "Descripción",
  "form.schedule": "Horario",
  "form.contactName": "Responsable",
  "form.socialUrl": "Red social o web",
  "form.isAnimal": "Es rescate animal",

  // ── Pie de página / red ─────────────────────────────────────────────────
  "footer.privacy": "Privacidad",
  "footer.terms": "Términos",
  "footer.api": "API pública",
  "footer.network": "HelpMaps en otros países",
  "footer.about": "Qué es HelpMaps",

  // ── Hub (helpmaps.net) ──────────────────────────────────────────────────
  "hub.title": "HelpMaps",
  "hub.tagline":
    "Un mapa abierto para encontrar ayuda y mostrar dónde hace falta, desplegable en cualquier país.",
  "hub.networkTitle": "Dónde está desplegado",
  "hub.networkSubtitle": "Toca un país para abrir su mapa.",
  "hub.live": "En línea",
  "hub.preparing": "En preparación",
  "hub.openSite": "Abrir {name}",
  "hub.whatTitle": "Qué es",
  "hub.whatBody":
    "HelpMaps publica, en un mapa, los puntos donde una comunidad puede recibir ayuda y los que necesitan algo ahora mismo: refugios, comedores, puntos de acopio e iniciativas ciudadanas. Nació durante una emergencia real y está hecho para funcionar con mala señal, en un teléfono cualquiera.",
  "hub.joinTitle": "Cómo ser parte",
  "hub.joinCountry": "Traer HelpMaps a tu país",
  "hub.joinCountryBody":
    "El repositorio es la base: se clona, se ajusta un archivo de configuración con el país, las regiones y la marca, se crea su propia base de datos y queda desplegado en su subdominio.",
  "hub.joinContribute": "Contribuir al código",
  "hub.joinContributeBody":
    "Es un proyecto abierto. Las mejoras que entran al repo base bajan a todos los despliegues.",
  "hub.joinData": "Aportar datos",
  "hub.joinDataBody":
    "Cada despliegue recibe sugerencias del público y las revisa un equipo local antes de publicarlas.",
  "hub.apiTitle": "API pública",
  "hub.apiBody":
    "Cada despliegue expone sus puntos verificados en JSON, sin llave y con CORS abierto, para que otras aplicaciones humanitarias puedan consumirlos.",
  "hub.apiDocs": "Ver documentación",
  "hub.terms": "Términos de uso",

  // ── Capas sísmicas ──────────────────────────────────────────────────────
  // Tono especialmente cuidado aquí: esto lo lee alguien que acaba de sentir el sismo.
  // Nada de cifras de víctimas, nada de superlativos, y siempre la palabra "estimación"
  // donde el dato es un modelo y no una medición.
  "layers.title": "Capas del mapa",
  "layers.cta": "Capas",
  "layers.epicenters": "Epicentros",
  "layers.epicentersHint": "Dónde se originó cada sismo",
  "layers.intensity": "Zona afectada",
  "layers.intensityHint": "Hasta dónde llegó el sacudón",
  "layers.none": "Sin sismos registrados en los últimos {n} días.",
  "layers.stale": "Datos sísmicos de una carga anterior.",
  "layers.disclaimer":
    "Intensidad estimada por USGS a partir del modelo del sismo. Se corrige en las horas siguientes y no reemplaza el reporte oficial de daños.",

  "quake.magnitude": "Magnitud",
  "quake.depth": "Profundidad",
  "quake.km": "{n} km",
  "quake.maxIntensity": "Intensidad máxima",
  "quake.felt": "{n} personas reportaron haberlo sentido",
  "quake.feltOne": "1 persona reportó haberlo sentido",
  "quake.tsunami": "Con aviso de tsunami",
  "quake.eventPage": "Ver el detalle en USGS",
  "quake.alert": "Impacto estimado",
  "quake.alert.green": "Menor",
  "quake.alert.yellow": "Local",
  "quake.alert.orange": "Regional",
  "quake.alert.red": "Extendido",
  "quake.source": "Datos sísmicos: USGS Earthquake Hazards Program",

  // Escala de Mercalli Modificada. Dos preguntas distintas por grado: qué se sintió, y
  // qué le hace a una construcción corriente. La segunda es la que decide si se abre
  // un refugio.
  "mmi.scale": "Intensidad (Mercalli)",
  "mmi.shaking": "Se sintió",
  "mmi.damage": "Daños esperables",
  "mmi.1.shaking": "No se siente",
  "mmi.1.damage": "Ninguno",
  "mmi.2.shaking": "Débil",
  "mmi.2.damage": "Ninguno",
  "mmi.4.shaking": "Ligero",
  "mmi.4.damage": "Ninguno",
  "mmi.5.shaking": "Moderado",
  "mmi.5.damage": "Muy leves",
  "mmi.6.shaking": "Fuerte",
  "mmi.6.damage": "Leves",
  "mmi.7.shaking": "Muy fuerte",
  "mmi.7.damage": "Moderados",
  "mmi.8.shaking": "Severo",
  "mmi.8.damage": "De moderados a graves",
  "mmi.9.shaking": "Violento",
  "mmi.9.damage": "Graves",
  "mmi.10.shaking": "Extremo",
  "mmi.10.damage": "Muy graves",
} as const;

export default es;
