"use client";

import type { LocationType } from "@/domain/types";
import type { CenterFilter } from "@/domain/center";
import { typeStyle } from "@/config";
import { TypeGlyph } from "@/ui/icons";
import { useSiteHelpers } from "@/features/app/SiteProvider";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";

/**
 * The type chips.
 *
 * Split out of `Filters` when search and the two dropdowns moved into the unified bar:
 * these belong under it, over the map, because they are the one control someone toggles
 * repeatedly while looking at the result. Putting them inside the bar would have made the
 * bar tall enough to be a second header.
 *
 * `data-tour="types"` is an anchor for the guided tour. Don't rename it.
 */
export default function TypeChips({
  filter,
  onChange,
}: {
  filter: CenterFilter;
  onChange: (next: CenterFilter) => void;
}) {
  const { t } = useI18n();
  // Places only: a digital initiative has its own tab, not a sixth chip in a five-column grid.
  const { pinTypes } = useSiteHelpers();

  function toggle(type: LocationType) {
    const on = filter.types.includes(type);
    onChange({
      ...filter,
      types: on ? filter.types.filter((x) => x !== type) : [...filter.types, type],
    });
  }

  return (
    <div className="chips" data-tour="types">
      {pinTypes().map((type) => {
        const on = filter.types.includes(type);
        return (
          <button
            key={type}
            type="button"
            className={`chip${on ? " chip-on" : ""}`}
            onClick={() => toggle(type)}
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
  );
}
