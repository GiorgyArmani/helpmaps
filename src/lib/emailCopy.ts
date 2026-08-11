import { LANGUAGE } from "@/config";
import type { Lang } from "@/i18n/types";

/**
 * Copy for outbound email.
 *
 * It lives here and not in `src/i18n/dictionaries/` for one reason: those dictionaries
 * are imported by the language context, which is a client component, so every string in
 * them is downloaded by every phone that opens the map. Nobody reading the map needs the
 * wording of a staff notification. This module is only ever imported by `src/lib/email.ts`,
 * which is `server-only`, so it never reaches a browser.
 *
 * It keeps the two properties that matter from the dictionary system:
 *
 *   • Spanish is the base and the only complete set; `en`/`pt` fall back key by key, so a
 *     missing translation sends real Spanish and never a raw key.
 *   • `config/language.ts` overrides win, exactly like the UI copy. A clone renames
 *     "voluntariado" or softens a line from its own config file, and keeps doing it
 *     without a merge conflict when it pulls from the base repo.
 *
 * Emails go out in the deployment's default language: we do not know what the recipient
 * reads (a suggestion carries no language, and the team inbox is one inbox). A caller
 * that does know may pass `lang`.
 */

const es = {
  // ── Marco compartido ──────────────────────────────────────────────────────
  "email.none": "—",
  "email.footer.note":
    "Aviso automático de {brand}. Puedes responder a este correo si necesitas algo del equipo.",

  // ── Sugerencia del público ────────────────────────────────────────────────
  "email.submission.subject": "[{brand}] Nueva sugerencia · {kind}",
  "email.submission.preheader": "Alguien sugirió un punto para el mapa.",
  "email.submission.title": "Nueva sugerencia",
  "email.submission.note":
    "Nadie fuera del equipo puede leer esta sugerencia. Se publica o se descarta desde el panel.",
  "email.submission.cta": "Abrir el panel",

  "email.kind.center": "Punto que falta",
  "email.kind.initiative": "Iniciativa ciudadana",
  "email.kind.need": "Necesidad de un punto",
  "email.kind.other": "Otro",

  // ── Mensaje del formulario «Escríbenos» ───────────────────────────────────
  "email.contact.subject": "[{brand}] {kind} · {name}",
  "email.contact.spamTag": "[POSIBLE SPAM]",
  "email.contact.preheader": "Mensaje de {name} · {kind}",
  "email.contact.title": "Nuevo mensaje",
  "email.contact.from": "De",
  "email.contact.noEmail": "sin correo",
  "email.contact.images": "{n} imagen(es) adjunta(s).",
  "email.contact.kind.donation": "Donaciones",
  "email.contact.kind.general": "Contacto",

  // ── Solicitud de voluntariado ─────────────────────────────────────────────
  "email.volunteer.subject": "[{brand}] Solicitud de voluntariado · {name}",
  "email.volunteer.preheader": "{name} quiere sumarse al equipo.",
  "email.volunteer.title": "Nueva solicitud de voluntariado",
  "email.volunteer.note":
    "Esta solicitud no crea ninguna cuenta ni da ningún acceso: alguien del equipo la aprueba desde el panel.",
  "email.volunteer.cta": "Revisar en el panel",

  // ── Bienvenida al equipo ──────────────────────────────────────────────────
  "email.welcome.subject": "Ya tienes acceso · {brand}",
  "email.welcome.preheader": "Ya tienes acceso al panel. Empieza por el manual.",
  "email.welcome.title": "Te damos la bienvenida a {brand}",
  "email.welcome.greeting": "Hola {name},",
  "email.welcome.greetingPlain": "Hola,",
  "email.welcome.intro":
    "ya tienes acceso al panel del equipo. Gracias por sumarte: cada punto que confirmas ayuda a que alguien encuentre ayuda cerca.",
  "email.welcome.live":
    "Confiamos en ti, así que lo que publicas se ve de inmediato en el mapa: no pasa por una cola de revisión. Por eso te pedimos leer el manual antes de tu primera publicación.",
  "email.welcome.ownPassword":
    "Entra con {email} y la contraseña que elegiste al postularte.",
  // Ya no se manda ninguna contraseña por correo: se manda un enlace para que la persona
  // cree la suya. Un correo es reenviable, se queda en la bandeja para siempre y viaja
  // por servidores que no controlamos; un enlace de un solo uso que caduca, no.
  "email.welcome.setPassword": "Crear mi contraseña",
  "email.welcome.setPasswordBody":
    "Tu cuenta es {email}. Crea tu contraseña con este botón: el enlace es de un solo uso y caduca en {hours} horas. Si caduca, pídele al equipo que te lo reenvíe.",
  "email.welcome.login": "Iniciar sesión",
  "email.welcome.manuals": "Manuales",
  "email.welcome.manualTitle": "Manual del voluntariado",
  "email.welcome.manualDesc":
    "Paso a paso del panel: cómo funciona por dentro, hasta dónde llega tu acceso y las reglas que no se rompen. Empieza por aquí.",
  "email.welcome.privacyTitle": "Privacidad y manejo de datos",
  "email.welcome.privacyDesc": "Qué se muestra, qué no se muestra nunca y por qué.",
  "email.welcome.guideTitle": "Guía de uso del mapa",
  "email.welcome.guideDesc": "Cómo lo usa alguien que está buscando ayuda ahora mismo.",
  "email.welcome.help":
    "Dentro del panel, el botón «?» reabre el recorrido guiado cuando lo necesites. ¿Dudas? Responde a este correo o escribe a {email}. Si no esperabas este mensaje, ignóralo.",

  // ── Etiquetas de campo ────────────────────────────────────────────────────
  "email.label.kind": "Tipo",
  "email.label.name": "Nombre",
  "email.label.email": "Correo",
  "email.label.contact": "Contacto",
  "email.label.phone": "Teléfono",
  "email.label.profile": "Perfil",
  "email.label.region": "Zona",
  "email.label.motivation": "Por qué quiere colaborar",
} as const;

export type EmailKey = keyof typeof es;

const en: Partial<Record<EmailKey, string>> = {
  "email.footer.note":
    "Automatic notice from {brand}. You can reply to this email if you need the team.",

  "email.submission.subject": "[{brand}] New suggestion · {kind}",
  "email.submission.preheader": "Someone suggested a point for the map.",
  "email.submission.title": "New suggestion",
  "email.submission.note":
    "Nobody outside the team can read this suggestion. Publish or discard it from the panel.",
  "email.submission.cta": "Open the panel",

  "email.kind.center": "Missing point",
  "email.kind.initiative": "Citizen initiative",
  "email.kind.need": "A point's need",
  "email.kind.other": "Other",

  "email.contact.subject": "[{brand}] {kind} · {name}",
  "email.contact.spamTag": "[LIKELY SPAM]",
  "email.contact.preheader": "Message from {name} · {kind}",
  "email.contact.title": "New message",
  "email.contact.from": "From",
  "email.contact.noEmail": "no email",
  "email.contact.images": "{n} image(s) attached.",
  "email.contact.kind.donation": "Donations",
  "email.contact.kind.general": "Contact",

  "email.volunteer.subject": "[{brand}] Volunteer request · {name}",
  "email.volunteer.preheader": "{name} wants to join the team.",
  "email.volunteer.title": "New volunteer request",
  "email.volunteer.note":
    "This request creates no account and grants no access: someone on the team approves it from the panel.",
  "email.volunteer.cta": "Review in the panel",

  "email.welcome.subject": "You're in · {brand}",
  "email.welcome.preheader": "You have panel access. Start with the manual.",
  "email.welcome.title": "Welcome to {brand}",
  "email.welcome.greeting": "Hi {name},",
  "email.welcome.greetingPlain": "Hi,",
  "email.welcome.intro":
    "you now have access to the team panel. Thank you for joining: every point you confirm helps someone find help nearby.",
  "email.welcome.live":
    "We trust you, so what you publish shows on the map immediately: there is no review queue in front of it. That is why we ask you to read the manual before your first entry.",
  "email.welcome.ownPassword": "Sign in with {email} and the password you chose when you applied.",
  "email.welcome.setPassword": "Create my password",
  "email.welcome.setPasswordBody":
    "Your account is {email}. Create your password with this button: the link is single-use and expires in {hours} hours. If it expires, ask the team to send you a new one.",
  "email.welcome.login": "Sign in",
  "email.welcome.manuals": "Manuals",
  "email.welcome.manualTitle": "Volunteer manual",
  "email.welcome.manualDesc":
    "Step by step through the panel: how it works, how far your access reaches and the rules that are never bent. Start here.",
  "email.welcome.privacyTitle": "Privacy and data handling",
  "email.welcome.privacyDesc": "What is shown, what is never shown, and why.",
  "email.welcome.guideTitle": "Map user guide",
  "email.welcome.guideDesc": "How someone looking for help right now uses it.",
  "email.welcome.help":
    "Inside the panel, the “?” button reopens the guided tour whenever you need it. Questions? Reply to this email or write to {email}. If you were not expecting this message, ignore it.",

  "email.label.kind": "Type",
  "email.label.name": "Name",
  "email.label.email": "Email",
  "email.label.contact": "Contact",
  "email.label.phone": "Phone",
  "email.label.profile": "Profile",
  "email.label.region": "Area",
  "email.label.motivation": "Why they want to help",
};

const pt: Partial<Record<EmailKey, string>> = {
  "email.footer.note":
    "Aviso automático de {brand}. Você pode responder a este e-mail se precisar da equipe.",

  "email.submission.subject": "[{brand}] Nova sugestão · {kind}",
  "email.submission.preheader": "Alguém sugeriu um ponto para o mapa.",
  "email.submission.title": "Nova sugestão",
  "email.submission.note":
    "Ninguém fora da equipe pode ler esta sugestão. Publique ou descarte pelo painel.",
  "email.submission.cta": "Abrir o painel",

  "email.kind.center": "Ponto que falta",
  "email.kind.initiative": "Iniciativa cidadã",
  "email.kind.need": "Necessidade de um ponto",
  "email.kind.other": "Outro",

  "email.contact.subject": "[{brand}] {kind} · {name}",
  "email.contact.spamTag": "[POSSÍVEL SPAM]",
  "email.contact.preheader": "Mensagem de {name} · {kind}",
  "email.contact.title": "Nova mensagem",
  "email.contact.from": "De",
  "email.contact.noEmail": "sem e-mail",
  "email.contact.images": "{n} imagem(ns) em anexo.",
  "email.contact.kind.donation": "Doações",
  "email.contact.kind.general": "Contato",

  "email.volunteer.subject": "[{brand}] Solicitação de voluntariado · {name}",
  "email.volunteer.preheader": "{name} quer se juntar à equipe.",
  "email.volunteer.title": "Nova solicitação de voluntariado",
  "email.volunteer.note":
    "Esta solicitação não cria conta nem dá acesso: alguém da equipe a aprova pelo painel.",
  "email.volunteer.cta": "Revisar no painel",

  "email.welcome.subject": "Você já tem acesso · {brand}",
  "email.welcome.preheader": "Você já tem acesso ao painel. Comece pelo manual.",
  "email.welcome.title": "Boas-vindas ao {brand}",
  "email.welcome.greeting": "Olá {name},",
  "email.welcome.greetingPlain": "Olá,",
  "email.welcome.intro":
    "você já tem acesso ao painel da equipe. Obrigado por se somar: cada ponto que você confirma ajuda alguém a encontrar ajuda perto.",
  "email.welcome.live":
    "Confiamos em você, então o que você publica aparece no mapa imediatamente: não passa por uma fila de revisão. Por isso pedimos que leia o manual antes da sua primeira publicação.",
  "email.welcome.ownPassword": "Entre com {email} e a senha que você escolheu ao se inscrever.",
  "email.welcome.login": "Entrar",
  "email.welcome.manuals": "Manuais",
  "email.welcome.manualTitle": "Manual do voluntariado",
  "email.welcome.manualDesc":
    "Passo a passo do painel: como funciona por dentro, até onde vai o seu acesso e as regras que não se quebram. Comece por aqui.",
  "email.welcome.privacyTitle": "Privacidade e tratamento de dados",
  "email.welcome.privacyDesc": "O que se mostra, o que nunca se mostra e por quê.",
  "email.welcome.guideTitle": "Guia de uso do mapa",
  "email.welcome.guideDesc": "Como usa quem está procurando ajuda agora.",
  "email.welcome.help":
    "Dentro do painel, o botão “?” reabre o tour guiado quando precisar. Dúvidas? Responda a este e-mail ou escreva para {email}. Se você não esperava esta mensagem, ignore-a.",

  "email.label.kind": "Tipo",
  "email.label.name": "Nome",
  "email.label.email": "E-mail",
  "email.label.contact": "Contato",
  "email.label.phone": "Telefone",
  "email.label.profile": "Perfil",
  "email.label.region": "Zona",
  "email.label.motivation": "Por que quer colaborar",
};

const PARTIALS: Record<Lang, Partial<Record<EmailKey, string>>> = { es: {}, en, pt };

const CACHE = new Map<Lang, Record<EmailKey, string>>();

function dict(lang: Lang): Record<EmailKey, string> {
  const cached = CACHE.get(lang);
  if (cached) return cached;
  // Same precedence as the UI: base ← translation ← deployment override.
  const overrides = LANGUAGE.overrides[lang] ?? {};
  const merged = { ...es, ...PARTIALS[lang], ...overrides } as Record<EmailKey, string>;
  CACHE.set(lang, merged);
  return merged;
}

export type EmailTranslate = (key: EmailKey, vars?: Record<string, string | number>) => string;

/** Translator for outbound email. Defaults to this deployment's language. */
export function emailT(lang: Lang = LANGUAGE.default): EmailTranslate {
  const d = dict(lang);
  return (key, vars) => {
    const raw = d[key] ?? String(key);
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m,
    );
  };
}
