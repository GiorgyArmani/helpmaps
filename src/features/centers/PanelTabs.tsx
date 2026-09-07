"use client";

import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";

export type PanelTab = "nearby" | "points" | "digital";

/**
 * The three tabs at the top of the points panel: what is around you, places you can go
 * to, and initiatives that help without a seat. Same visual language as the staff
 * panel's `admtabs` — one row of pills, the active one filled — so it reads as part of
 * the same product.
 *
 * A tab and not a sixth type chip: the chips grid is five equal columns on purpose, and
 * neither a digital initiative nor a distance is a kind of place to filter among places.
 *
 * ICON ONLY, like `admtabs`. With three tabs the words stopped fitting on a 390px
 * phone: "Puntos" lost four letters to an ellipsis over a sub-pixel shortfall, and every
 * language and every count width was one word away from breaking it again. Three icons
 * always fit, in every language, whatever the counts say — and the tab that is on is
 * filled, so which list you are in never depends on reading anything. The name lives in
 * `aria-label` and `title`, so a screen reader and a hover still get the word.
 *
 * "Cerca" goes FIRST because it answers the question people actually open this with on
 * the street. Its pill carries no count until there is a location: a zero there would
 * read as "there is nothing near you" when what it means is "nobody has asked yet".
 *
 * `data-tour="paneltabs"` is an optional anchor: a deck without that step simply skips
 * it.
 */
export default function PanelTabs({
  tab,
  counts,
  onChange,
}: {
  tab: PanelTab;
  counts: { nearby: number | null; points: number; digital: number };
  onChange: (next: PanelTab) => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="ptabs" data-tour="paneltabs">
      <TabButton
        on={tab === "nearby"}
        label={t("panel.tab.nearby")}
        count={counts.nearby}
        icon={<Icon.target />}
        onClick={() => onChange("nearby")}
      />
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
  /** `null` hides the pill: see the note above about a count nobody has asked for. */
  count: number | null;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ptab${on ? " ptab-on" : ""}`}
      onClick={onClick}
      aria-current={on}
      aria-label={label}
      title={label}
    >
      <span className="ptab-ic">{icon}</span>
      {count === null ? null : <span className="ptab-n">{count}</span>}
    </button>
  );
}
