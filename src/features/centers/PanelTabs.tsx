"use client";

import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

export type PanelTab = "points" | "digital";

/**
 * The two tabs at the top of the points panel: places you can go to, and initiatives
 * that help without a seat. Same visual language as the staff panel's `admtabs` — one
 * row of pills, the active one filled — so it reads as part of the same product.
 *
 * A tab and not a sixth type chip: the chips grid is five equal columns on purpose, and
 * a digital initiative is not a kind of place to filter among places. It is a different
 * list, sharing the search box and the region filter.
 *
 * `data-tour="paneltabs"` is a new, optional anchor: a deck without that step simply
 * skips it.
 */
export default function PanelTabs({
  tab,
  counts,
  onChange,
}: {
  tab: PanelTab;
  counts: { points: number; digital: number };
  onChange: (next: PanelTab) => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="ptabs" data-tour="paneltabs">
      <TabButton
        on={tab === "points"}
        label={t("map.points")}
        count={counts.points}
        icon={<Icon.directions />}
        onClick={() => onChange("points")}
      />
      <TabButton
        on={tab === "digital"}
        label={t("panel.tab.digital")}
        count={counts.digital}
        icon={<Icon.globe />}
        onClick={() => onChange("digital")}
      />
    </nav>
  );
}

function TabButton({
  on,
  label,
  count,
  icon,
  onClick,
}: {
  on: boolean;
  label: string;
  count: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ptab${on ? " ptab-on" : ""}`}
      onClick={onClick}
      aria-current={on}
    >
      <span className="ptab-ic">{icon}</span>
      {label}
      <span className="ptab-n">{count}</span>
    </button>
  );
}
