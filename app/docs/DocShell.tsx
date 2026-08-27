import type { ReactNode } from "react";
import Link from "next/link";
import type { Lang } from "@/i18n/types";
import { BRAND, LANGUAGE } from "@/config";
import { DocTopbar } from "./DocTopbar";

/**
 * The frame the hand-written docs share with the generated ones (`[slug]`).
 *
 * The country-specific legal pages cannot come from `docs-content.ts` — they name the
 * controller and the law from `config/`, which differ per clone — but they must not look
 * like a different site either. This puts them inside the same shell.
 */

// The project name, not this deployment's. See `BRAND.platform` in src/config/types.ts.
const PLATFORM_UC = BRAND.platform.toUpperCase();

const KICKER: Record<Lang, string> = {
  es: `DOCUMENTACIÓN · ${PLATFORM_UC}`,
  en: `DOCUMENTATION · ${PLATFORM_UC}`,
  pt: `DOCUMENTAÇÃO · ${PLATFORM_UC}`,
};

const BACK_APP: Record<Lang, string> = {
  es: "Volver a la app",
  en: "Back to the app",
  pt: "Voltar ao app",
};

const DOCS_LABEL: Record<Lang, string> = {
  es: "Documentación",
  en: "Documentation",
  pt: "Documentação",
};

// Same two words the generated `[slug]` pages end on, so every doc leaves the same way.
const BACK_DOCS: Record<Lang, string> = {
  es: "← Documentación",
  en: "← Documentation",
  pt: "← Documentação",
};

const GO_MAP: Record<Lang, string> = {
  es: "Ir al mapa",
  en: "Go to the map",
  pt: "Ir para o mapa",
};

const qs = (l: Lang) => (l === LANGUAGE.default ? "" : `?lang=${l}`);


export function DocShell({
  lang = "es",
  base,
  title,
  lead,
  children,
}: {
  lang?: Lang;
  /** This page's path, so the language toggle comes back to it. */
  base: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <div className="doc-wrap">
      <DocTopbar
        lang={lang}
        base={base}
        backLabel={BACK_APP[lang]}
        docsLabel={DOCS_LABEL[lang]}
      />
      <div className="doc-content">
        <div className="doc-card">
          <div className="doc-kicker">{KICKER[lang]}</div>
          <h1 className="doc-h1">{title}</h1>
          {lead ? <p className="doc-lead">{lead}</p> : null}
          {children}

          {/* Every doc has to offer the way back to the index. The generated `[slug]`
              pages already ended on these two buttons; the hand-written ones did not,
              and their only route back was the brand mark in the top bar — which reads
              as a logo, not as navigation, and is hidden outright on phones. So from a
              phone, the legal pages were a dead end. */}
          <div className="doc-actions">
            <Link href={`/docs${qs(lang)}`} className="doc-secondary">
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

/** One titled block inside a DocShell. */
export function DocSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="doc-section">
      <h2 className="doc-h2">{heading}</h2>
      {children}
    </section>
  );
}

/**
 * "github.com/usuario/repo" — sin esquema, que en un enlace visible solo estorba.
 * Vive aquí porque lo usan las dos páginas que enseñan el repositorio: los términos
 * (dentro de una frase) y el instructivo de despliegue (como enlace destacado).
 */
export function repoLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}
