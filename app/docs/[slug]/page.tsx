import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Lang } from "@/i18n/types";
import { BRAND } from "@/config";
import { DocTopbar } from "../DocTopbar";
import { tr } from "@/content/roadmap";
import { DOCS, getDoc } from "@/content/docs-content";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

const pickLang = (v?: string): Lang => (v === "en" ? "en" : v === "pt" ? "pt" : "es");

const PLATFORM_UC = BRAND.platform.toUpperCase();
const KICKER = {
  es: `DOCUMENTACIÓN · ${PLATFORM_UC}`,
  en: `DOCUMENTATION · ${PLATFORM_UC}`,
  pt: `DOCUMENTAÇÃO · ${PLATFORM_UC}`,
};
const BACK_APP = { es: "Volver a la app", en: "Back to the app", pt: "Voltar ao app" };
const NEED_HELP = { es: "¿Necesitas algo o quieres colaborar? ", en: "Need something or want to collaborate? ", pt: "Precisa de algo ou quer colaborar? " };
const BACK_DOCS = { es: "← Documentación", en: "← Documentation", pt: "← Documentação" };
const GO_MAP = { es: "Ir al mapa", en: "Go to the map", pt: "Ir para o mapa" };
const DOCS_LABEL = { es: "Documentación", en: "Documentation", pt: "Documentação" };

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return { title: BRAND.platform };
  const lang = pickLang((await searchParams).lang);
  return {
    title: `${tr(doc.title, lang)} · ${BRAND.platform}`,
    description: tr(doc.intro, lang),
    alternates: {
      canonical: `/docs/${slug}` + (lang === "es" ? "" : `?lang=${lang}`),
    },
  };
}

export default async function DocPage({ params, searchParams }: Props) {
  const doc = getDoc((await params).slug);
  if (!doc) notFound();
  const lang = pickLang((await searchParams).lang);
  const qs = (l: Lang) => (l === "es" ? "" : `?lang=${l}`);
  const docsHref = `/docs${qs(lang)}`;

  return (
    <div className="doc-wrap">
      <DocTopbar lang={lang} base={`/docs/${doc.slug}`} backLabel={BACK_APP[lang]} docsLabel={DOCS_LABEL[lang]} />
      <div className="doc-content">
        <div className="doc-card">
          <div className="doc-kicker">{KICKER[lang]}</div>
          <h1 className="doc-h1">{tr(doc.title, lang)}</h1>
          <p className="doc-lead">{tr(doc.intro, lang)}</p>

        {doc.sections.map((sec, i) => (
          <section key={i} className="doc-section">
            <h2 className="doc-h2">{tr(sec.heading, lang)}</h2>
            {sec.blocks.map((b, n) => (
              <div key={n} className="doc-block">
                {b.label && <span className="doc-block-label">{tr(b.label, lang)}: </span>}
                {b.text && <span className="doc-block-text">{tr(b.text, lang)}</span>}
                {b.bullets && (
                  <ul className="doc-bullets">
                    {b.bullets.map((li, m) => (
                      <li key={m} className="doc-bullet">
                        {tr(li, lang)}
                      </li>
                    ))}
                  </ul>
                )}
                {(b.link || b.links) && (
                  <div className="doc-links">
                    {[...(b.link ? [b.link] : []), ...(b.links ?? [])].map((lk, k) =>
                      // Internal doc cross-links stay in the same tab and carry the
                      // current language, so an English reader doesn't land on Spanish.
                      lk.href.startsWith("/") ? (
                        <Link key={k} className="doc-link" href={`${lk.href}${qs(lang)}`}>
                          {tr(lk.label, lang)}
                        </Link>
                      ) : (
                        <a
                          key={k}
                          className="doc-link"
                          href={lk.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {tr(lk.label, lang)}
                          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                            <path
                              d="M7 17 17 7M9 7h8v8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </a>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}

        <p className="doc-note">
          {NEED_HELP[lang]}
          <a href={`mailto:${BRAND.contact.email}`} className="doc-mail">
            {BRAND.contact.email}
          </a>
        </p>

          <div className="doc-actions">
            <Link href={docsHref} className="doc-secondary">
              {BACK_DOCS[lang]}
            </Link>
            <Link href="/" className="doc-primary">
              {GO_MAP[lang]}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
