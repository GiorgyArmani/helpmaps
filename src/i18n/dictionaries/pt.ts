import type { Dict } from "@/i18n";

/**
 * Portuguese is offered where a border population needs it (Venezuela/Brazil). It is
 * intentionally thin: the keys translated here are the ones someone in an emergency
 * hits first — find a point, read its status, call it. Everything else falls back to
 * Spanish, which is far closer to Portuguese than English is.
 */
const pt: Partial<Dict> = {
  "common.close": "Fechar",
  "common.cancel": "Cancelar",
  "common.save": "Salvar",
  "common.back": "Voltar",
  "common.search": "Buscar",
  "common.loading": "Carregando…",
  "common.retry": "Tentar de novo",
  "common.copy": "Copiar",
  "common.copied": "Copiado",
  "common.unknown": "Sem dado",
  "common.all": "Todos",

  "time.now": "agora mesmo",
  "time.minutes": "há {n} min",
  "time.hours": "há {n} h",
  "time.days": "há {n} dias",
  "time.oneDay": "ontem",

  "error.generic": "Algo deu errado. Tente de novo.",
  "error.network": "Sem conexão. Verifique o sinal e tente de novo.",

  "map.searchPlaceholder": "Buscar por nome ou município",
  "map.myLocation": "Minha localização",
  "map.pointsCount": "{n} pontos",
  "map.noResults": "Nenhum ponto corresponde ao filtro",

  "type.shelter": "Abrigo",
  "type.shelter.plural": "Abrigos",
  "type.donation_centre": "Ponto de coleta",
  "type.donation_centre.plural": "Pontos de coleta",
  "type.comedor": "Cozinha comunitária",
  "type.comedor.plural": "Cozinhas comunitárias",
  "type.iniciativa": "Iniciativa cidadã",
  "type.iniciativa.plural": "Iniciativas cidadãs",
  "type.hospital": "Hospital",
  "type.hospital.plural": "Hospitais",

  "status.abierto": "Aberto",
  "status.lleno": "Lotado",
  "status.cerrado": "Fechado",
  "status.unknown": "Não confirmado",
  "status.closedWarning": "Este ponto está fechado. Ligue antes de ir.",
  "status.fullWarning": "Este ponto está lotado. Confirme antes de levar doações.",
  "status.staleWarning": "Ninguém confirma este ponto há {n} dias. Ligue antes de ir.",

  "center.needsTitle": "Precisa agora",
  "center.receivesTitle": "Recebe",
  "center.helpTitle": "Como ajudar",
  "center.scheduleTitle": "Horário",
  "center.contactTitle": "Contato",
  "center.directions": "Como chegar",
  "center.call": "Ligar",
  "center.share": "Compartilhar",
  "center.updated": "Atualizado {ago}",
  "center.noNeeds": "Este ponto não informou necessidades.",
  "center.disclaimer":
    "Esta informação é informada pelo próprio ponto ou pela equipe em campo. Não garante vaga nem disponibilidade: confirme por telefone antes de se deslocar.",

  "needs.barCount": "{n} pontos precisam de ajuda",
  "needs.listTitle": "Onde falta ajuda",
  "needs.empty": "Nenhum ponto informou necessidades ainda.",

  "share.title": "Compartilhar",
  "share.copyLink": "Copiar link",
  "share.linkCopied": "Link copiado",

  // ── Doações ─────────────────────────────────────────────────────────────
  "donate.cta": "Doar",
  "donate.ctaHint": "Organizações que recebem contribuições para esta emergência.",
  "donate.title": "Doar",
  "donate.subtitle":
    "Organizações e iniciativas que recebem contribuições. Cada uma tem o link da sua página: confira antes de doar.",
  "donate.none": "Ainda não há nenhuma organização publicada.",
  "donate.data": "Dados para doar",
  "donate.follow": "Ver a página",
  "donate.go": "Doar",
  "donate.joinTitle": "A sua organização recebe doações?",
  "donate.joinBody":
    "Se você pode mostrar no que se transforma o que recebe, escreva para nós e entramos com você nesta lista.",
  "donate.joinCta": "Fale conosco",
  "donate.note":
    "Não recebemos nem administramos dinheiro. Esta lista só diz quem faz isso e como verificar.",

  "contact.title": "Fale conosco",
  "contact.subDonation":
    "Conte quem são, o que fazem com o que recebem e como quem doa pode comprovar isso.",
  "contact.subGeneral": "Escreva para a equipe que mantém o mapa.",
  "contact.message": "Mensagem",
  "contact.messageHintDonation":
    "Nome da organização, o que fazem, onde publicam o que recebem e os dados para doar.",
  "contact.name": "Seu nome",
  "contact.email": "Seu e-mail",
  "contact.emailHint": "Para podermos responder. Não é publicado.",
  "contact.photos": "Imagens",
  "contact.photosHint": "Até 4. São comprimidas antes do envio.",
  "contact.addPhoto": "Anexar imagem",
  "contact.photoError": "Não conseguimos processar essa imagem. Tente outra.",
  "contact.submit": "Enviar",
  "contact.sending": "Enviando…",
  "contact.done": "Mensagem enviada",
  "contact.doneBody": "Nós lemos e respondemos no e-mail que você deixou.",
  "contact.error": "Não conseguimos enviar. Tente de novo em instantes.",
  "contact.tooMany": "Muitas mensagens seguidas. Espere um minuto e tente de novo.",

  // ── Entrada (/inicio) ───────────────────────────────────────────────────
  "entry.titleNeed": "Precisa de ajuda?",
  "entry.titleGive": "Quer ajudar?",
  "entry.lead": "{brand} é onde quem precisa de ajuda e quem quer ajudar se encontram.",
  "entry.needHelp": "Preciso de ajuda",
  "entry.needHelpDesc": "Encontre abrigos, cozinhas e pontos de coleta perto de você.",
  "entry.wantHelp": "Quero ajudar",
  "entry.wantHelpDesc": "Veja o que falta e onde, ou registre a sua iniciativa.",
  "entry.enter": "Entrar no mapa",
  "entry.statsTitle": "O que está publicado hoje",
  "entry.statsNote": "Com o que cada ponto recebe, o que precisa agora e se continua aberto.",
  "entry.campaignTag": "Chamado aberto",
  "entry.campaignTitle": "A sua iniciativa está ajudando? Coloque-a no mapa",
  "entry.campaignBody":
    "Brigadas, cozinhas, pontos de água, apoio psicológico, resgate animal. Sem distinção política, social ou racial.",
  "entry.campaignCta": "Registrar minha iniciativa",
  "entry.campaignFine": "É gratuito e sempre será. Verificamos cada ponto antes de publicar.",

  // ── Camadas sísmicas ────────────────────────────────────────────────────
  "layers.title": "Camadas do mapa",
  "layers.cta": "Camadas",
  "layers.epicenters": "Epicentros",
  "layers.epicentersHint": "Onde cada sismo se originou",
  "layers.intensity": "Zona afetada",
  "layers.intensityHint": "Até onde chegou o tremor",
  "layers.none": "Nenhum sismo registrado nos últimos {n} dias.",
  "layers.stale": "Dados sísmicos de um carregamento anterior.",
  "layers.disclaimer":
    "Intensidade estimada pelo USGS a partir do modelo do sismo. É corrigida nas horas seguintes e não substitui o relatório oficial de danos.",

  "quake.magnitude": "Magnitude",
  "quake.depth": "Profundidade",
  "quake.km": "{n} km",
  "quake.maxIntensity": "Intensidade máxima",
  "quake.felt": "{n} pessoas relataram ter sentido",
  "quake.feltOne": "1 pessoa relatou ter sentido",
  "quake.tsunami": "Com alerta de tsunami",
  "quake.eventPage": "Ver o detalhe no USGS",
  "quake.alert": "Impacto estimado",
  "quake.alert.green": "Menor",
  "quake.alert.yellow": "Local",
  "quake.alert.orange": "Regional",
  "quake.alert.red": "Generalizado",
  "quake.source": "Dados sísmicos: USGS Earthquake Hazards Program",

  "mmi.scale": "Intensidade (Mercalli)",
  "mmi.shaking": "Sentiu-se",
  "mmi.damage": "Danos esperados",
  "mmi.1.shaking": "Não se sente",
  "mmi.1.damage": "Nenhum",
  "mmi.2.shaking": "Fraco",
  "mmi.2.damage": "Nenhum",
  "mmi.4.shaking": "Leve",
  "mmi.4.damage": "Nenhum",
  "mmi.5.shaking": "Moderado",
  "mmi.5.damage": "Muito leves",
  "mmi.6.shaking": "Forte",
  "mmi.6.damage": "Leves",
  "mmi.7.shaking": "Muito forte",
  "mmi.7.damage": "Moderados",
  "mmi.8.shaking": "Severo",
  "mmi.8.damage": "De moderados a graves",
  "mmi.9.shaking": "Violento",
  "mmi.9.damage": "Graves",
  "mmi.10.shaking": "Extremo",
  "mmi.10.damage": "Muito graves",
};

export default pt;
