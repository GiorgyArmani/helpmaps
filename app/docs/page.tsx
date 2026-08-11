import type { Metadata } from "next";
import Link from "next/link";
import type { Lang } from "@/i18n/types";
import { BRAND } from "@/config";
import { DocTopbar } from "./DocTopbar";

type SearchParams = { searchParams: Promise<{ lang?: string }> };

const pickLang = (v?: string): Lang => (v === "en" ? "en" : v === "pt" ? "pt" : "es");

// The project name, not this deployment's. See `BRAND.platform` in src/config/types.ts.
const PLATFORM_UC = BRAND.platform.toUpperCase();

type Lstr = { es: string; en: string; pt: string };

const TITLE: Lstr = {
  es: `Documentación · ${BRAND.platform}`,
  en: `Documentation · ${BRAND.platform}`,
  pt: `Documentação · ${BRAND.platform}`,
};
const DESC: Lstr = {
  es: `Documentación de ${BRAND.platform}: guía de uso, roadmap, privacidad y cómo colaborar, financiar o desplegar la plataforma.`,
  en: `${BRAND.platform} documentation: usage guide, roadmap, privacy, and how to collaborate, fund or deploy the platform.`,
  pt: `Documentação do ${BRAND.platform}: guia de uso, roadmap, privacidade e como colaborar, financiar ou implantar a plataforma.`,
};

export async function generateMetadata({ searchParams }: SearchParams): Promise<Metadata> {
  const lang = pickLang((await searchParams).lang);
  return {
    title: TITLE[lang],
    description: DESC[lang],
    alternates: {
      canonical: "/docs" + (lang === "es" ? "" : `?lang=${lang}`),
    },
  };
}

// Sections we plan to publish. `href` flips an item from "coming soon" to a real link.
// `feature` visually highlights a card (used for the partnerships/funding call-out).
// The documentation index. `href` is what turns a card into a real link; `feature`
// highlights one card (used for the partnerships/funding call-out).
const SECTIONS: { title: Lstr; desc: Lstr; href?: string; feature?: boolean }[] = [
  {
    title: {"es":"Guía de uso","en":"Usage guide","pt":"Guia de uso"},
    desc: {"es":"Cómo encontrar ayuda y cómo ofrecerla: el mapa y sus filtros, la ficha de un punto, compartir, colaborar y usar la app sin conexión.","en":"How to find help and how to offer it: the map and its filters, a point card, sharing, contributing and using the app offline.","pt":"Como encontrar ajuda e como oferecê-la: o mapa e seus filtros, a ficha de um ponto, compartilhar, colaborar e usar o app sem conexão."},
    href: "/docs/guia",
  },
  {
    title: {"es":"Cómo cuidamos los datos","en":"How we protect data","pt":"Como cuidamos dos dados"},
    desc: {"es":"Los lugares se publican para que circulen; las personas se protegen. Qué se publica de alguien afectado, qué no se publica nunca y por qué.","en":"Places are published so they travel; people are protected. What is published about an affected person, what never is, and why.","pt":"Os lugares são publicados para circular; as pessoas são protegidas. O que se publica de alguém afetado, o que nunca se publica e por quê."},
    href: "/docs/datos",
  },
  {
    title: {"es":"Manual del equipo","en":"Team manual","pt":"Manual da equipe"},
    desc: {"es":"Para quien tiene acceso al panel: publicar puntos, mantener necesidades y estado al día, revisar sugerencias y las reglas que no se rompen.","en":"For anyone with panel access: publishing points, keeping needs and status current, reviewing suggestions, and the rules that do not bend.","pt":"Para quem tem acesso ao painel: publicar pontos, manter necessidades e status em dia, revisar sugestões e as regras que não se quebram."},
    href: "/docs/manual-voluntario",
  },
  {
    title: {"es":"Colabora, financia y despliega","en":"Collaborate, fund & deploy","pt":"Colabore, financie e implante"},
    desc: {"es":"Proyecto abierto y sin fines de lucro. Financia, aporta en especie, despliégalo en tu país o súmate como aliado.","en":"An open, non-profit project. Fund it, give in-kind support, deploy it in your country or join as an ally.","pt":"Projeto aberto e sem fins lucrativos. Financie, contribua em espécie, implante no seu país ou junte-se como aliado."},
    href: "/docs/colabora",
    feature: true,
  },
  {
    title: {"es":"Roadmap","en":"Roadmap","pt":"Roteiro"},
    desc: {"es":"Qué ya funciona y qué viene después, por fases.","en":"What already works and what comes next, by phase.","pt":"O que já funciona e o que vem a seguir, por fases."},
    href: "/docs/roadmap",
  },
  {
    title: {"es":"Privacidad","en":"Privacy","pt":"Privacidade"},
    desc: {"es":"Política formal de este despliegue: responsable, base legal, plazos y cómo ejercer tus derechos.","en":"This deployment's formal policy: controller, lawful basis, retention and how to exercise your rights.","pt":"Política formal desta implantação: responsável, base legal, prazos e como exercer seus direitos."},
    href: "/docs/privacidad",
  },
  {
    title: {"es":"Términos de uso","en":"Terms of use","pt":"Termos de uso"},
    desc: {"es":"Para qué sirve, qué no garantiza y qué usos no están permitidos.","en":"What it is for, what it does not guarantee and which uses are not allowed.","pt":"Para que serve, o que não garante e quais usos não são permitidos."},
    href: "/docs/terminos",
  },
  {
    title: {"es":"API pública","en":"Public API","pt":"API pública"},
    desc: {"es":"Los puntos publicados en JSON, sin llave, para que otras aplicaciones humanitarias los consuman.","en":"Published points as JSON, with no key, so other humanitarian applications can consume them.","pt":"Os pontos publicados em JSON, sem chave, para que outras aplicações humanitárias os consumam."},
    href: "/docs/api",
  },
  {
    title: {"es":"Para prensa","en":"For press","pt":"Para imprensa"},
    desc: {"es":"Qué es, qué puede afirmarse de sus datos y qué no.","en":"What it is, what can be claimed about its data and what cannot.","pt":"O que é, o que pode ser afirmado sobre seus dados e o que não."},
    href: "/docs/prensa",
  },
];

const T = {
  backToApp: { es: "Volver a la app", en: "Back to the app", pt: "Voltar ao app" } as Lstr,
  kicker: {
    es: `DOCUMENTACIÓN · ${PLATFORM_UC}`,
    en: `DOCUMENTATION · ${PLATFORM_UC}`,
    pt: `DOCUMENTAÇÃO · ${PLATFORM_UC}`,
  } as Lstr,
  h1: { es: "Documentación", en: "Documentation", pt: "Documentação" } as Lstr,
  // `BRAND.platform`, not `BRAND.name` and not a literal. This page documents the
  // PROJECT, not this country's deployment of it — every other string around it already
  // says "HelpMaps" rather than "HelpMaps Colombia". It used to read "HelpMap VE", so a
  // clone's docs introduced the original deployment instead of the platform.
  lead: {
    es: `Cómo funciona ${BRAND.platform}: guía de uso, roadmap del proyecto, privacidad y manejo de datos, y cómo ser voluntario o colaborar.`,
    en: `How ${BRAND.platform} works: usage guide, project roadmap, privacy and data handling, and how to volunteer or collaborate.`,
    pt: `Como funciona o ${BRAND.platform}: guia de uso, roadmap do projeto, privacidade e manejo de dados, e como ser voluntário ou colaborar.`,
  } as Lstr,
  forPartners: { es: "Aliados y financistas", en: "Partners & funders", pt: "Parceiros e financiadores" } as Lstr,
  soon: { es: "Próximamente", en: "Coming soon", pt: "Em breve" } as Lstr,
  noteAsk: {
    es: "¿Necesitas algo ahora o quieres colaborar? Escríbenos a ",
    en: "Need something now or want to collaborate? Write to ",
    pt: "Precisa de algo agora ou quer colaborar? Escreva para ",
  } as Lstr,
  goToMap: { es: "Ir al mapa", en: "Go to the map", pt: "Ir para o mapa" } as Lstr,
};

// One icon per section (keyed by its /docs/<slug>), shown in a tinted square on each tile.
const sv = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const ICONS: Record<string, React.ReactNode> = {
  guia: sv(
    <>
      <path d="M12 7v13" />
      <path d="M3 5a1 1 0 0 1 1-1h5a3 3 0 0 1 3 3 3 3 0 0 1 3-3h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a2 2 0 0 0-2 2 2 2 0 0 0-2-2H4a1 1 0 0 1-1-1z" />
    </>,
  ),
  colabora: sv(<path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z" />),
  roadmap: sv(
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </>,
  ),
  privacidad: sv(
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>,
  ),
  // Stacked discs — the data this deployment holds. Distinct from `privacidad` (a
  // shield): that page is the formal policy, this one is what we actually store.
  datos: sv(
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      <path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>,
  ),
  // Angle brackets and a slash — the universal mark for a developer-facing endpoint.
  api: sv(
    <>
      <path d="m8 17-5-5 5-5" />
      <path d="m16 7 5 5-5 5" />
      <path d="m13.5 4-3 16" />
    </>,
  ),
  "manual-voluntario": sv(
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="m9.5 9.5 1.5 1.5 3-3" />
    </>,
  ),
  terminos: sv(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>,
  ),
  prensa: sv(
    <>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>,
  ),
};

/** Generic page, for a section added here before anyone drew it a glyph. */
const FALLBACK_ICON = sv(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </>,
);

/**
 * The tile glyph for a section.
 *
 * Falls back rather than rendering nothing: `ICONS` is keyed by URL slug, so renaming a
 * section's `href` silently emptied its icon box — which is how `datos` and `api` ended
 * up as blank squares, the map still holding the ORIGINAL deployment's slugs
 * (`voluntarios`, `politica-privacidad`) that nothing links to any more.
 */
function tileIcon(href?: string) {
  const slug = href?.split("/").pop() ?? "";
  return ICONS[slug] ?? FALLBACK_ICON;
}

export default async function DocsPage({ searchParams }: SearchParams) {
  const lang = pickLang((await searchParams).lang);
  const t = (o: Lstr) => o[lang];
  const qs = (l: Lang) => (l === "es" ? "" : `?lang=${l}`);
  const withLang = (href: string) => `${href}${qs(lang)}`;

  const chevron = (
    <span className="doc-tile-chev" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </span>
  );

  return (
    <div className="doc-wrap">
      <DocTopbar lang={lang} base="/docs" backLabel={t(T.backToApp)} docsLabel={t(T.h1)} />
      <div className="doc-content">
        <div className="doc-card">
          <div className="doc-kicker">{t(T.kicker)}</div>
          <h1 className="doc-h1">{t(T.h1)}</h1>
          <p className="doc-lead">{t(T.lead)}</p>

        <div className="doc-grid">
          {SECTIONS.map((s) =>
            s.href ? (
              <Link
                key={s.title.es}
                href={withLang(s.href)}
                className={"doc-tile" + (s.feature ? " doc-tile-feature" : "")}
              >
                {chevron}
                <span className="doc-tile-ic">{tileIcon(s.href)}</span>
                {s.feature && <span className="doc-feature-tag">{t(T.forPartners)}</span>}
                <span className="doc-tile-title">{t(s.title)}</span>
                <p className="doc-tile-desc">{t(s.desc)}</p>
              </Link>
            ) : (
              <div key={s.title.es} className="doc-tile doc-tile-soon">
                <span className="doc-tile-ic">{tileIcon(s.href)}</span>
                <span className="doc-item-soon">{t(T.soon)}</span>
                <span className="doc-tile-title">{t(s.title)}</span>
                <p className="doc-tile-desc">{t(s.desc)}</p>
              </div>
            ),
          )}
        </div>

        <p className="doc-note">
          {t(T.noteAsk)}
          <a href={`mailto:${BRAND.contact.email}`} className="doc-mail">
            {BRAND.contact.email}
          </a>
          .
        </p>

          <div className="doc-single">
            <Link href="/" className="doc-primary">
              {t(T.goToMap)}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
