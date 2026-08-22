"use client";

import { useState } from "react";
import { Icon } from "@/ui/icons";
import { useSite } from "@/features/app/SiteProvider";
import { useI18n } from "@/i18n/context";

/**
 * The region selector.
 *
 * It was a native `<select>`, and next to it sat the point picker — a custom panel with a
 * search box and grouped rows. Two controls side by side in the same field, one of which
 * opened an operating-system list in a completely different typeface and metric. This is
 * the same markup and the same `cpick-*` classes as the point picker, so the pair reads as
 * one control.
 *
 * The regions come from `useSite()`, so a region added to the emergency row shows up here
 * without a deploy.
 */
export default function RegionPicker({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (code: string | null) => void;
}) {
  const { t } = useI18n();
  const site = useSite();
  const [open, setOpen] = useState(false);

  const regions = site.country.regions;
  const selected = regions.find((r) => r.code === value) ?? null;
  const all = t("map.allRegions", { regions: site.country.regionNoun.many });

  function choose(code: string | null) {
    onPick(code);
    setOpen(false);
  }

  return (
    <div className="cpick" data-tour="filters">
      <button
        type="button"
        className="cpick-btn"
        aria-expanded={open}
        aria-label={site.country.regionNoun.one}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon.directions />
        <span className="cpick-val">{selected?.name ?? all}</span>
        <Icon.chevron className="cpick-chev" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="cpick-back"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div className="cpick-panel">
            <div className="cpick-list">
              <button
                type="button"
                className={`cpick-opt${value === null ? " cpick-opt-on" : ""}`}
                onClick={() => choose(null)}
              >
                <span>{all}</span>
              </button>

              {regions.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className={`cpick-opt${value === r.code ? " cpick-opt-on" : ""}`}
                  onClick={() => choose(r.code)}
                >
                  <span>{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
