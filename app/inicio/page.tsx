import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND, COUNTRY, FEATURES, IS_HUB, LANGUAGE, enabledTypes } from "@/config";
import { resolveLang, translator, type DictKey } from "@/i18n";
import type { Lang } from "@/i18n/types";
import type { LocationType } from "@/domain/types";
import { Icon } from "@/ui/icons";
import { fetchCoverage } from "./coverage";
import NewsSection from "@/features/news/NewsSection";
import "./entry.css";

/**
 * The entry page — where the printed QR points (`<país>.helpmaps.net/inicio`).
 *
 * It asks the one question that routes a visitor ("do you need help, or do you want to
 * help?") and shows where the project actually IS today: live counts of what is already
 * published, plus the open call to register civic initiatives.
 *
 * `proxy.ts` sends a first-time visitor of `/` here ONCE per browser and never again:
 * the primary user is someone searching for help right now, and making them clear a
 * landing page on every reload costs them time exactly when they have none.
 *
 * Server component: the only client JS is whatever the app loads after a tap. It renders
 * per request because it reads `?lang=` (same as /docs), so the counts are cached for 30
 * minutes in `coverage.ts` instead — this page is opened on one bar of signal and must
 * not wait on a database round trip per visitor.
 */

export const metadata: Metadata = (() => {
  const t = translator(LANGUAGE.default);
  return {
    title: `${BRAND.name} · ${t("entry.titleNeed")} ${t("entry.titleGive")}`,
    description: t("entry.lead", { brand: BRAND.name }),
    alternates: { canonical: "/inicio" },
  };
})();

const LOCALE: Record<Lang, string> = { es: "es", en: "en", pt: "pt" };

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The hub has its own landing, and a clone may not want a gate at all. Either way the
  // map is the right place to be, and /inicio must not become a dead end.
  if (IS_HUB || !FEATURES.entryPage) redirect("/");

  const params = await searchParams;
  const raw = params.lang;
  const lang = resolveLang(Array.isArray(raw) ? raw[0] : raw);
  const t = translator(lang);

  // Links into the app. `a=` is the action the map opens with (see `app/page.tsx`), and
  // the language rides along so someone reading in English does not land in Spanish.
  const app = (action?: "needs" | "initiative") => {
    const parts = [
      lang === LANGUAGE.default ? "" : `lang=${lang}`,
      action ? `a=${action}` : "",
    ].filter(Boolean);
    return parts.length ? `/?${parts.join("&")}` : "/";
  };

  const coverage = await fetchCoverage();

  // Only a figure we actually have. A "0" on a landing page reads as failure, and a type
  // this country has no data for yet is exactly the case: it is the ask below, not a
  // statistic. Ordered by the map's own type order and capped so the grid stays 2×2.
  const stats = coverage
    ? enabledTypes()
        .map((type: LocationType) => ({ type, n: coverage[type] ?? 0 }))
        .filter((s) => s.n > 0)
        .slice(0, 4)
    : [];

  return (
    <main className="entry">
      <div className="entry-card">
        <header className="entry-head">
          <span className="entry-logo" aria-hidden="true">
            {BRAND.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- one static asset, no layout shift to optimise away
              <img src={BRAND.logo} alt="" />
            ) : (
              (BRAND.emoji || COUNTRY.code.slice(0, 1))
            )}
          </span>
          <div className="entry-brand">{COUNTRY.host}</div>
          <h1 className="entry-h1">
            {t("entry.titleNeed")}
            <br />
            <span className="entry-hi">{t("entry.titleGive")}</span>
          </h1>
          <p className="entry-lead">{t("entry.lead", { brand: BRAND.name })}</p>
        </header>

        <nav className="entry-opts">
          {/* Priority path: someone looking for a point of help right now. */}
          <Link href={app()} className="entry-opt entry-need">
            <span className="entry-ico" aria-hidden="true">
              <Icon.search width={26} height={26} />
            </span>
            <span className="entry-txt">
              <span className="entry-t">{t("entry.needHelp")}</span>
              <span className="entry-d">{t("entry.needHelpDesc")}</span>
            </span>
            <span className="entry-arrow" aria-hidden="true">
              <Icon.chevron width={20} height={20} />
            </span>
          </Link>

          {/* Help path: opens the "where help is needed" list inside the app. */}
          <Link href={app("needs")} className="entry-opt entry-give">
            <span className="entry-ico" aria-hidden="true">
              <Icon.heart width={26} height={26} />
            </span>
            <span className="entry-txt">
              <span className="entry-t">{t("entry.wantHelp")}</span>
              <span className="entry-d">{t("entry.wantHelpDesc")}</span>
            </span>
            <span className="entry-arrow" aria-hidden="true">
              <Icon.chevron width={20} height={20} />
            </span>
          </Link>
        </nav>

        {stats.length > 0 ? (
          <section className="entry-stats" aria-label={t("entry.statsTitle")}>
            <div className="entry-stats-t">{t("entry.statsTitle")}</div>
            <ul className="entry-stat-list">
              {stats.map((s) => (
                <li key={s.type} className="entry-stat">
                  <b className="entry-n">{s.n.toLocaleString(LOCALE[lang])}</b>
                  <span className="entry-l">{t(`type.${s.type}.plural` as DictKey)}</span>
                </li>
              ))}
            </ul>
            <p className="entry-note">{t("entry.statsNote")}</p>
          </section>
        ) : null}

        {/* Lo que se está reportando. Va después de las cifras y antes de la llamada a
            colaborar: quien abre esto sin buscar un refugio suele estar entendiendo qué
            pasó, y esa es la respuesta. Se renderiza en el servidor y no aparece si no
            hay boletín. */}
        <NewsSection />

        {/* The open call. This is the ask, not a statistic — there are usually none on the
            map yet, which is precisely why it is here and not in the strip above. */}
        {FEATURES.suggestions ? (
          <section className="entry-camp" aria-labelledby="entry-camp-h">
            <span className="entry-tag">{t("entry.campaignTag")}</span>
            <h2 id="entry-camp-h" className="entry-camp-h">
              {t("entry.campaignTitle")}
            </h2>
            <p className="entry-camp-p">{t("entry.campaignBody")}</p>
            <Link href={app("initiative")} className="entry-camp-btn">
              {t("entry.campaignCta")}
              <Icon.chevron width={17} height={17} />
            </Link>
            <p className="entry-fine">{t("entry.campaignFine")}</p>
          </section>
        ) : null}

        {/* An escape hatch for anyone who just wants the map, without reading a word. */}
        <Link href={app()} className="entry-skip">
          {t("entry.enter")} →
        </Link>

        <footer className="entry-foot">
          {/* The tagline is a config string, written in this deployment's language: showing
              it to someone reading in another one is just a sentence they cannot read. */}
          {lang === LANGUAGE.default ? <span className="entry-note">{BRAND.tagline}</span> : null}
          {/* Legal notices have to be reachable from the product, not only from /docs. */}
          <span className="entry-foot-links">
            <Link href={`/docs/privacidad?lang=${lang}`} className="entry-foot-link">
              {t("footer.privacy")}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href={`/docs/terminos?lang=${lang}`} className="entry-foot-link">
              {t("footer.terms")}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href={`/docs?lang=${lang}`} className="entry-foot-link">
              {t("footer.about")}
            </Link>
          </span>
        </footer>
      </div>
    </main>
  );
}
