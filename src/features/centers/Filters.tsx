"use client";

import type { Center, LocationType } from "@/domain/types";
import type { CenterFilter } from "@/domain/center";
import { COUNTRY, enabledTypes, typeStyle } from "@/config";
import { Icon, TypeGlyph } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import CenterPicker from "@/features/centers/CenterPicker";
import type { DictKey } from "@/i18n";

/**
 * The floating chrome over the map: search, the two dropdowns (region and point) and the
 * type chips. Same arrangement as the original app — it is the mobile-first layout the
 * team tuned on real phones, and on desktop the same three rows centre themselves.
 *
 * `data-tour` ids are anchors for the guided tour. Don't rename them: the tour deck is
 * copied verbatim from the original and finds its targets by these strings.
 */
export default function Filters({
  filter,
  onChange,
  centers,
  selectedId,
  onPickCenter,
}: {
  filter: CenterFilter;
  onChange: (next: CenterFilter) => void;
  centers: Center[];
  selectedId: string | null;
  onPickCenter: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const types = enabledTypes();

  function toggleType(type: LocationType) {
    const on = filter.types.includes(type);
    onChange({
      ...filter,
      types: on ? filter.types.filter((x) => x !== type) : [...filter.types, type],
    });
  }

  return (
    <>
      <div className="searchbar" data-tour="search">
        <Icon.search className="si" />
        <input
          className="sinput"
          type="search"
          inputMode="search"
          value={filter.query}
          placeholder={t("map.searchPlaceholder")}
          aria-label={t("common.search")}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
        />
        {filter.query ? (
          <button
            type="button"
            className="sx"
            aria-label={t("common.close")}
            onClick={() => onChange({ ...filter, query: "" })}
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="frow2" data-tour="filters">
        <div className="fdrop">
          <Icon.directions />
          <select
            value={filter.region ?? ""}
            aria-label={COUNTRY.regionNoun.one}
            onChange={(e) => onChange({ ...filter, region: e.target.value || null })}
          >
            <option value="">{t("map.allRegions", { regions: COUNTRY.regionNoun.many })}</option>
            {COUNTRY.regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <CenterPicker centers={centers} valueId={selectedId} onPick={onPickCenter} />
      </div>

      <div className="chips" data-tour="types">
        {types.map((type) => {
          const on = filter.types.includes(type);
          return (
            <button
              key={type}
              type="button"
              className={`chip${on ? " chip-on" : ""}`}
              onClick={() => toggleType(type)}
              aria-pressed={on}
            >
              <span className="tico" style={{ color: on ? "#fff" : typeStyle(type).color }}>
                <TypeGlyph name={typeStyle(type).icon} size={15} />
              </span>
              {t(`type.${type}.plural` as DictKey)}
            </button>
          );
        })}
      </div>
    </>
  );
}
