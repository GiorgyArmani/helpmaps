"use client";

import type { Center } from "@/domain/types";
import { directionsUrl, lastTouched } from "@/domain/center";
import { typeStyle } from "@/config";
import { Icon, TypeGlyph } from "@/ui/icons";
import { Badge } from "@/ui/primitives";
import { useI18n, useTimeAgo } from "@/i18n/context";
import { StatusBadge, StatusWarning } from "@/features/centers/CenterStatus";
import ShareRow from "@/features/share/ShareRow";
import { telHref, whatsappHref } from "@/features/share/share";
import type { DictKey } from "@/i18n";
import { useSiteHelpers } from "@/features/app/SiteProvider";

/**
 * The full card for one point.
 *
 * The order is deliberate and worth preserving: name → how fresh this is → any warning
 * (closed / full / stale) → what it needs → how to reach it. Someone reading this on a
 * phone at 4% battery gets the decision-changing facts first, and freshness before
 * content, because "is this still true" outranks everything it says.
 */
export default function CenterDetail({ center }: { center: Center }) {
  const { regionLabel } = useSiteHelpers();
  const { t } = useI18n();
  const ago = useTimeAgo();
  const style = typeStyle(center.type);
  const info = center.info;
  const place = [center.municipality, regionLabel(center.region)].filter(Boolean).join(", ");
  const touched = lastTouched(center);
  const confirmed = info?.last_confirmed_at;

  return (
    <>
      <div className="dhero">
        <span className="dav" style={{ color: style.color }}>
          <TypeGlyph name={style.icon} size={38} />
        </span>
        <div>
          <h2 className="dname">{center.name}</h2>
          <div className="dsub">
            {t(`type.${center.type}` as DictKey)}
            {place ? ` · ${place}` : ""}
          </div>
        </div>
        <div className="wrapline" style={{ justifyContent: "center" }}>
          <StatusBadge center={center} />
          {info?.is_animal ? <Badge tone="off">{t("center.animal")}</Badge> : null}
        </div>
      </div>

      <div className="dupdated-hero">
        <span className="duh-label">
          {confirmed ? t("center.confirmedLabel") : t("center.updatedLabel")}
        </span>
        <span className="duh-time">{touched ? ago(touched) : t("common.unknown")}</span>
        {touched ? (
          <span className="duh-date">{new Date(touched).toLocaleString()}</span>
        ) : (
          <span className="duh-date">{t("center.neverConfirmed")}</span>
        )}
      </div>

      {/* Above the needs on purpose: whether the point still exists outranks what it
          is asking for. */}
      <StatusWarning center={center} />

      {info?.needs?.trim() ? (
        <div className="dneed">
          <span className="dneed-l">{t("center.needsTitle")}</span>
          <p className="dneed-t">{info.needs}</p>
        </div>
      ) : null}

      {info && info.help.length > 0 ? (
        <>
          <h3 className="dsection">{t("center.helpTitle")}</h3>
          <div className="dtags">
            {info.help.map((h) => (
              <span key={h} className="dtag">
                {t(`help.${h}` as DictKey)}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {info && info.receives.length > 0 ? (
        <>
          <h3 className="dsection">{t("center.receivesTitle")}</h3>
          <div className="dtags">
            {info.receives.map((r) => (
              <span key={r} className="dtag">
                {r}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {info?.description ? <p className="sdesc">{info.description}</p> : null}

      <div className="drows">
        <div className="drow">
          <span className="dlabel">{t("form.type")}</span>
          <span className="dval dval-type">
            <span className="dval-type-ic" style={{ color: style.color }}>
              <TypeGlyph name={style.icon} size={14} />
            </span>
            {t(`type.${center.type}` as DictKey)}
          </span>
        </div>
        {place ? (
          <div className="drow">
            <span className="dlabel">{t("form.region")}</span>
            <span className="dval">{place}</span>
          </div>
        ) : null}
        {center.address ? (
          <div className="drow">
            <span className="dlabel">{t("form.address")}</span>
            <span className="dval">{center.address}</span>
          </div>
        ) : null}
        {info?.schedule ? (
          <div className="drow">
            <span className="dlabel">{t("center.scheduleTitle")}</span>
            <span className="dval">{info.schedule}</span>
          </div>
        ) : null}
        {info?.category ? (
          <div className="drow">
            <span className="dlabel">{t("center.categoryTitle")}</span>
            <span className="dval">{info.category}</span>
          </div>
        ) : null}
        {info?.contact_name ? (
          <div className="drow">
            <span className="dlabel">{t("center.responsible")}</span>
            <span className="dval">{info.contact_name}</span>
          </div>
        ) : null}
      </div>

      <div className="dactions">
        <button
          type="button"
          className="btnp"
          onClick={() => window.open(directionsUrl(center), "_blank", "noopener")}
        >
          <Icon.directions />
          {t("center.directions")}
        </button>

        {center.whatsapp ? (
          <button
            type="button"
            className="btng btnwa"
            onClick={() => window.open(whatsappHref(center.whatsapp!), "_blank", "noopener")}
          >
            <Icon.whatsapp />
            {t("center.whatsapp")}
          </button>
        ) : null}

        {center.phone ? (
          <button
            type="button"
            className="btng btncall"
            onClick={() => {
              window.location.href = telHref(center.phone!);
            }}
          >
            <Icon.phone />
            {t("center.call")} · {center.phone}
          </button>
        ) : null}

        {info?.social_url ? (
          <a className="btng" href={info.social_url} target="_blank" rel="noopener noreferrer">
            <Icon.link />
            {t("center.socialLink")}
          </a>
        ) : null}
      </div>

      <h3 className="dsection">{t("share.title")}</h3>
      <ShareRow center={center} />

      <div className="ddisclaimer">
        <Icon.alert />
        <span>{t("center.disclaimer")}</span>
      </div>

      {/* Attribution only for rows that actually came from a partner feed — crediting a
          hand-added point to someone else is its own kind of wrong. */}
      {info?.external_id && info.source ? (
        <p className="dsource">{t("center.source", { source: info.source })}</p>
      ) : null}
    </>
  );
}
