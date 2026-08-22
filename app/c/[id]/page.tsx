import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchCenter } from "@/data/centers";
import { daysSince, directionsUrl, isStale, lastTouched, statusOf } from "@/domain/center";
import { BRAND, COUNTRY, MAPCFG, regionLabel } from "@/config";
import { translator, resolveLang } from "@/i18n";
import { telHref, whatsappHref } from "@/features/share/share";
import type { DictKey } from "@/i18n";
import { currentEmergencyId } from "@/server/emergency";

/**
 * The shareable card for one point.
 *
 * Server-rendered on purpose: this URL is what travels through WhatsApp and Telegram, so
 * it has to produce a link preview and it has to open with content on a connection that
 * cannot afford to boot the whole map first. The "ver en el mapa" link hands off to the
 * app for anyone who wants context.
 */

export const revalidate = 120;

type Params = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const sb = supabasePublic();
  if (!sb) return { title: BRAND.name };
  const center = await fetchCenter(sb, id, await currentEmergencyId()).catch(() => null);
  if (!center) return { title: BRAND.name };

  const place = [center.municipality, regionLabel(center.region)].filter(Boolean).join(", ");
  const need = center.info?.needs?.trim();
  const description = need ? `Necesita: ${need}` : `${place || COUNTRY.name} · ${BRAND.tagline}`;

  return {
    title: center.name,
    description,
    openGraph: { title: center.name, description, type: "article" },
    twitter: { card: "summary", title: center.name, description },
    alternates: { canonical: `/c/${center.id}` },
  };
}

export default async function CenterPage({ params, searchParams }: Params) {
  const { id } = await params;
  const query = await searchParams;
  const lang = resolveLang(Array.isArray(query.lang) ? query.lang[0] : query.lang);
  const t = translator(lang);

  const sb = supabasePublic();
  if (!sb) notFound();
  const center = await fetchCenter(sb, id, await currentEmergencyId()).catch(() => null);
  if (!center) notFound();

  const status = statusOf(center);
  const place = [center.municipality, regionLabel(center.region)].filter(Boolean).join(", ");
  const staleDays = daysSince(lastTouched(center));

  return (
    <main className="page">
      <Link className="page-back" href="/">
        ← {BRAND.name}
      </Link>

      <header>
        <h1>{center.name}</h1>
        <p className="page-meta">
          {t(`type.${center.type}` as DictKey)}
          {place ? ` · ${place}` : ""}
        </p>
      </header>

      {/* The warning comes before the needs: whether the point still exists outranks
          what it is asking for. */}
      {status === "cerrado" ? (
        <p className="page-meta" style={{ color: "var(--danger)", fontWeight: 600 }}>
          {t("status.closedWarning")}
        </p>
      ) : status === "lleno" ? (
        <p className="page-meta" style={{ color: "var(--warn)", fontWeight: 600 }}>
          {t("status.fullWarning")}
        </p>
      ) : isStale(center) ? (
        <p className="page-meta" style={{ color: "var(--warn)", fontWeight: 600 }}>
          {t("status.staleWarning", { n: staleDays ?? MAPCFG.staleAfterDays })}
        </p>
      ) : null}

      {center.info?.needs ? (
        <section>
          <h2>{t("center.needsTitle")}</h2>
          <p>{center.info.needs}</p>
        </section>
      ) : null}

      {center.info && center.info.receives.length > 0 ? (
        <section>
          <h2>{t("center.receivesTitle")}</h2>
          <p>{center.info.receives.join(" · ")}</p>
        </section>
      ) : null}

      {center.info?.schedule ? (
        <section>
          <h2>{t("center.scheduleTitle")}</h2>
          <p>{center.info.schedule}</p>
        </section>
      ) : null}

      <section>
        <h2>{t("center.contactTitle")}</h2>
        <ul>
          {center.address ? <li>{center.address}</li> : null}
          {center.phone ? (
            <li>
              <a href={telHref(center.phone)}>{center.phone}</a>
            </li>
          ) : null}
          {center.whatsapp ? (
            <li>
              <a href={whatsappHref(center.whatsapp)} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </li>
          ) : null}
          <li>
            <a href={directionsUrl(center)} target="_blank" rel="noopener noreferrer">
              {t("center.directions")}
            </a>
          </li>
        </ul>
      </section>

      <p>
        <Link href={`/?c=${center.id}`}>{t("entry.enter")} →</Link>
      </p>

      <p className="page-meta">{t("center.disclaimer")}</p>
    </main>
  );
}
