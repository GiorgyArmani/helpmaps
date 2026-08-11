import Link from "next/link";
import dynamic from "next/dynamic";
import { BRAND, NETWORK } from "@/config";
import { translator } from "@/i18n";
import type { Lang } from "@/i18n/types";

const HubMap = dynamic(() => import("@/features/hub/HubMap"));

/**
 * helpmaps.net — the network hub.
 *
 * Three jobs, in the order a visitor needs them: where HelpMaps is running (a map, one
 * pin per country, clickable), what it is, and how to take part — bring it to your
 * country, contribute code, or contribute data. The API documentation and the terms hang
 * off it.
 *
 * Server-rendered: this page is the front door for press, funders and partner
 * organisations, so it has to arrive as HTML, fast, and be readable by a crawler.
 */
export default function HubLanding({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const live = NETWORK.filter((d) => d.status === "live");

  return (
    <main className="hub">
      <header className="hub-section">
        <div className="hub-card-head">
          <span className="logo" aria-hidden>
            {BRAND.emoji}
          </span>
          {BRAND.platform}
        </div>
        <h1 className="hub-title">{t("hub.tagline")}</h1>
        <p className="hub-lead">{t("hub.whatBody")}</p>
      </header>

      <section className="hub-section" id="paises">
        <div>
          <h2 className="hub-h2">{t("hub.networkTitle")}</h2>
          <p className="mut">{t("hub.networkSubtitle")}</p>
        </div>

        <HubMap />

        <div className="hub-grid">
          {NETWORK.map((d) => {
            const isLive = d.status === "live";
            const body = (
              <>
                <div className="hub-card-head">
                  <span aria-hidden>
                    {d.flag}
                  </span>
                  {d.name}
                </div>
                {d.note ? <p className="small mut">{d.note}</p> : null}
                <p className="small">
                  {isLive ? `${t("hub.live")} · ${hostOf(d.url)}` : t("hub.preparing")}
                </p>
              </>
            );
            return isLive ? (
              <a
                key={d.slug}
                className="hub-card"
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("hub.openSite", { name: d.name })}
              >
                {body}
              </a>
            ) : (
              <div key={d.slug} className="hub-card">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <section className="hub-section" id="sumate">
        <h2 className="hub-h2">{t("hub.joinTitle")}</h2>
        <div className="hub-grid">
          <div className="hub-card">
            <div className="hub-card-head">{t("hub.joinCountry")}</div>
            <p className="small">{t("hub.joinCountryBody")}</p>
            <Link className="small" href="/docs/desplegar">
              {t("hub.joinCountry")} →
            </Link>
          </div>
          <div className="hub-card">
            <div className="hub-card-head">{t("hub.joinContribute")}</div>
            <p className="small">{t("hub.joinContributeBody")}</p>
            <a className="small" href={`mailto:${BRAND.contact.email}`}>
              {BRAND.contact.email}
            </a>
          </div>
          <div className="hub-card">
            <div className="hub-card-head">{t("hub.joinData")}</div>
            <p className="small">{t("hub.joinDataBody")}</p>
            {live[0] ? (
              <a className="small" href={live[0].url} target="_blank" rel="noopener noreferrer">
                {t("hub.openSite", { name: live[0].name })} →
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="hub-section" id="api">
        <h2 className="hub-h2">{t("hub.apiTitle")}</h2>
        <p>{t("hub.apiBody")}</p>
        <code className="code">
          {live
            .map((d) => `GET ${d.url}/api/v1/centers?needs=true`)
            .join("\n") || "GET https://<pais>.helpmaps.net/api/v1/centers"}
        </code>
        <p>
          <Link href="/docs/api">{t("hub.apiDocs")} →</Link>
        </p>
      </section>

      <footer className="hub-foot">
        <Link href="/docs/terminos">{t("hub.terms")}</Link>
        <Link href="/docs/privacidad">{t("footer.privacy")}</Link>
        <Link href="/docs/api">{t("footer.api")}</Link>
        <Link href="/docs/desplegar">{t("hub.joinCountry")}</Link>
      </footer>
    </main>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
