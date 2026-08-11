// Full-width sticky top bar shared by every /docs page: back-to-app (left), the brand
// (centre) and the language toggle (right). Uses the horizontal space on desktop instead
// of cramming the nav inside the narrow content card.
//
// Everything here comes from `config/`. The ported version had the original deployment's
// name and logo written into it — `/ico.png`, which is a file in the Venezuela repo and
// not in this one, so the docs header showed a broken image next to the wrong product
// name. Same rule as everywhere else: no clone-specific copy, paths or languages inline.
import Link from "next/link";
import type { Lang } from "@/i18n/types";
import { BRAND, COUNTRY, LANGUAGE } from "@/config";
import { FLAG_ICON, LANG_NAME } from "@/ui/flags";

const qs = (l: Lang) => (l === LANGUAGE.default ? "" : `?lang=${l}`);

export function DocTopbar({
  lang,
  base,
  backLabel,
  docsLabel,
}: {
  lang: Lang;
  base: string; // path the language toggle points at (this page), e.g. "/docs" or "/docs/roadmap"
  backLabel: string;
  docsLabel: string;
}) {
  return (
    <header className="doc-topbar">
      <Link href="/" className="doc-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </Link>
      <Link
        href={`/docs${qs(lang)}`}
        className="doc-brand"
        aria-label={`${BRAND.name} · ${docsLabel}`}
      >
        {/* Same fallback as the map header: a clone with no logo yet gets a filled mark
            rather than an empty box. */}
        <span className="doc-brand-mark">
          {BRAND.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a config-provided path, not a known-size asset
            <img src={BRAND.logo} alt="" width={26} height={26} />
          ) : (
            <span aria-hidden>{BRAND.emoji || COUNTRY.code}</span>
          )}
        </span>
        <span>
          <span className="doc-brand-name">{BRAND.name}</span>{" "}
          <span className="doc-brand-sub">· {docsLabel}</span>
        </span>
      </Link>
      <div className="doc-langs">
        {LANGUAGE.available.map((l) => (
          <Link
            key={l}
            href={`${base}${qs(l)}`}
            className={l === lang ? "doc-lg doc-lg-on" : "doc-lg"}
            aria-label={LANG_NAME[l]}
          >
            <span className="doc-flag">{FLAG_ICON[l]}</span>
            {l.toUpperCase()}
          </Link>
        ))}
      </div>
    </header>
  );
}
