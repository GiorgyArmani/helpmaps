"use client";

import type { Center } from "@/domain/types";
import { statusOf } from "@/domain/center";
import { typeStyle } from "@/config";
import { Icon, TypeGlyph } from "@/ui/icons";
import { Badge } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import { useSiteHelpers } from "@/features/app/SiteProvider";
import { coverageLabel, instagramUrl } from "@/features/centers/coverage";
import { whatsappHref } from "@/features/share/share";

/**
 * One digital initiative in the list.
 *
 * Same anatomy as `CenterCard` — avatar, name, meta, status — with two differences that
 * are the whole point of the type: the location line says WHERE IT HELPS (regions, not a
 * municipality), and the links are on the card. A helpline or a volunteer network is
 * reached through a link, not by walking there, so the link is the card's primary
 * action and should not be a tap away.
 *
 * `CenterCard` is a single `<button>`; links inside a button are invalid HTML and a
 * screen reader would read one control. So this one is an `<article>` with the tappable
 * body as its own button and the links beside it.
 */
export default function DigitalCard({
  center,
  onSelect,
}: {
  center: Center;
  onSelect: (id: string) => void;
}) {
  const { regionLabel } = useSiteHelpers();
  const { t } = useI18n();
  const style = typeStyle(center.type);
  const info = center.info;
  const status = statusOf(center);
  const where = coverageLabel(center, regionLabel, t);

  return (
    <article className="card dcard">
      <button type="button" className="dcard-main" onClick={() => onSelect(center.id)}>
        <span className="av" style={{ color: style.color }}>
          <TypeGlyph name={style.icon} size={20} />
        </span>

        <span className="cmid">
          <span className="cname">{center.name}</span>
          <span className="cmeta">{info?.category ?? t("digital.noSeat")}</span>
          <span className="cloc">
            <Icon.globe />
            {where}
          </span>
        </span>

        <span className="cend">
          {status === "cerrado" ? (
            <Badge tone="danger">{t("status.cerrado")}</Badge>
          ) : status === "abierto" ? (
            <Badge tone="ok">{t("status.abierto")}</Badge>
          ) : null}
        </span>
      </button>

      {info?.website || info?.instagram || center.whatsapp ? (
        <span className="clinks">
          {info?.website ? (
            <a
              className="clink"
              href={info.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("center.website")}
              title={t("center.website")}
            >
              <Icon.link />
            </a>
          ) : null}
          {info?.instagram ? (
            <a
              className="clink"
              href={instagramUrl(info.instagram)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("center.instagram")}
              title={t("center.instagram")}
            >
              <Icon.spark />
            </a>
          ) : null}
          {center.whatsapp ? (
            <a
              className="clink clink-wa"
              href={whatsappHref(center.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("center.whatsapp")}
              title={t("center.whatsapp")}
            >
              <Icon.whatsapp />
            </a>
          ) : null}
        </span>
      ) : null}
    </article>
  );
}
