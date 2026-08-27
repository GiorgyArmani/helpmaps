"use client";

import type { Center } from "@/domain/types";
import { statusOf } from "@/domain/center";
import { typeStyle } from "@/config";
import { Icon, TypeGlyph } from "@/ui/icons";
import { Badge } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { useSiteHelpers } from "@/features/app/SiteProvider";

/**
 * One point in the list.
 *
 * The need is on the card, not behind a tap: the list exists so that "what is missing
 * where" can be scanned by someone deciding where to go next.
 */
export default function CenterCard({
  center,
  onSelect,
}: {
  center: Center;
  onSelect: (id: string) => void;
}) {
  const { regionLabel } = useSiteHelpers();
  const { t } = useI18n();
  const style = typeStyle(center.type);
  const place = center.municipality ?? regionLabel(center.region);
  const need = center.info?.needs?.trim();
  const status = statusOf(center);

  return (
    <button type="button" className="card" onClick={() => onSelect(center.id)}>
      <span className="av" style={{ color: style.color }}>
        <TypeGlyph name={style.icon} size={20} />
      </span>

      <span className="cmid">
        <span className="cname">{center.name}</span>
        <span className="cmeta">{t(`type.${center.type}` as DictKey)}</span>
        {need ? (
          <span className="cneed">{need}</span>
        ) : place ? (
          <span className="cloc">
            <Icon.directions />
            {place}
          </span>
        ) : null}
      </span>

      <span className="cend">
        {status === "cerrado" ? (
          <Badge tone="danger">{t("status.cerrado")}</Badge>
        ) : status === "lleno" ? (
          <Badge tone="warn">{t("status.lleno")}</Badge>
        ) : status === "abierto" ? (
          <Badge tone="ok">{t("status.abierto")}</Badge>
        ) : null}
        <Icon.chevron className="chev" />
      </span>
    </button>
  );
}
