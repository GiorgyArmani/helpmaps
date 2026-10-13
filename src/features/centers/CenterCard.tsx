"use client";

import type { Center } from "@/domain/types";
import { queryMatch, statusOf } from "@/domain/center";
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
  distanceLabel,
  query,
}: {
  center: Center;
  onSelect: (id: string) => void;
  /**
   * «600 m», «4,2 km». Sólo lo pasa la pestaña «Cerca», que es la única lista ordenada
   * por distancia; en las demás no habría un desde-dónde y el número sería decorativo.
   * Ya viene formateado: la tarjeta no sabe de kilómetros ni de idiomas.
   */
  distanceLabel?: string;
  /**
   * Lo que se está buscando, cuando la tarjeta es un RESULTADO. Con él la tarjeta dice por
   * qué salió: «Disponible: agua» y «Recibe: agua» son dos puertas opuestas, y sin la
   * etiqueta quien busca agua para su casa no distingue la que la reparte de la que la junta.
   */
  query?: string;
}) {
  const { regionLabel } = useSiteHelpers();
  const { t } = useI18n();
  const style = typeStyle(center.type);
  const place = center.municipality ?? regionLabel(center.region);
  const need = center.info?.needs?.trim();
  const status = statusOf(center);
  const match = query ? queryMatch(center, query) : null;

  return (
    <button type="button" className="card" onClick={() => onSelect(center.id)}>
      <span className="av" style={{ color: style.color }}>
        <TypeGlyph name={style.icon} size={20} />
      </span>

      <span className="cmid">
        <span className="cname">{center.name}</span>
        <span className="cmeta">{t(`type.${center.type}` as DictKey)}</span>
        {match ? (
          <span className={`cmatch cmatch-${match.field}`}>
            {match.field === "offers" ? <Icon.check /> : <Icon.box />}
            {t(match.field === "offers" ? "offers.inline" : "search.receives", {
              list: match.terms.slice(0, 4).join(", "),
            })}
          </span>
        ) : need ? (
          <span className="cneed">{need}</span>
        ) : place ? (
          <span className="cloc">
            <Icon.directions />
            {place}
          </span>
        ) : null}
      </span>

      <span className="cend">
        {distanceLabel ? <span className="cdist">{distanceLabel}</span> : null}
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
