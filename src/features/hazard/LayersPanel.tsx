"use client";

import { useState } from "react";
import { SEISMIC } from "@/config";
import { INTENSITY_BANDS } from "@/domain/hazard";
import type { QuakeState } from "@/features/hazard/useQuakes";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";

export interface HazardLayers {
  epicenters: boolean;
  intensity: boolean;
}

/**
 * The map-layers control: what to draw over the base map, and what the colours mean.
 *
 * It is a separate control rather than two more chips in the top bar, for two reasons.
 * The chips answer "which KIND OF HELP do I want to see" and these answer "what happened
 * here" — folding them together would make turning off hospitals and turning off the
 * earthquake look like the same gesture. And the top bar is already the row that runs out
 * of horizontal room first.
 *
 * The intensity legend lives here rather than as a permanent strip on the map because it
 * is only meaningful while that layer is on, and a phone screen showing a shelter list
 * has no pixels to spare for a key nobody is reading.
 */
export default function LayersPanel({
  layers,
  onChange,
  state,
}: {
  layers: HazardLayers;
  onChange: (next: HazardLayers) => void;
  state: QuakeState;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!SEISMIC.enabled) return null;

  const active = layers.epicenters || layers.intensity;
  // Only the bands this event actually reached. A legend running to "X — very heavy" on
  // a map whose worst contour is VI reads as a forecast of what is still coming.
  const reached = state.contours.length > 0 ? Math.max(...state.contours.map((c) => c.mmi)) : 0;
  const bands = INTENSITY_BANDS.filter((b) => b.degree >= 2 && b.degree <= Math.max(reached, 2));

  return (
    <div className="layersctl">
      {open ? (
        <>
          <button
            type="button"
            className="layers-backdrop"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div className="layers-panel" role="group" aria-label={t("layers.title")}>
            <div className="layers-head">
              <b>{t("layers.title")}</b>
              <button
                type="button"
                className="layers-x"
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
              >
                <Icon.close />
              </button>
            </div>

            <label className="layers-opt">
              <input
                type="checkbox"
                checked={layers.intensity}
                onChange={(e) => onChange({ ...layers, intensity: e.target.checked })}
              />
              <span className="layers-opt-ic">
                <Icon.waves />
              </span>
              <span className="layers-opt-txt">
                <b>{t("layers.intensity")}</b>
                <small>{t("layers.intensityHint")}</small>
              </span>
            </label>

            <label className="layers-opt">
              <input
                type="checkbox"
                checked={layers.epicenters}
                onChange={(e) => onChange({ ...layers, epicenters: e.target.checked })}
              />
              <span className="layers-opt-ic">
                <Icon.target />
              </span>
              <span className="layers-opt-txt">
                <b>{t("layers.epicenters")}</b>
                <small>{t("layers.epicentersHint")}</small>
              </span>
            </label>

            {layers.intensity && bands.length > 0 ? (
              <div className="layers-legend">
                <span className="layers-legend-h">{t("mmi.scale")}</span>
                {bands.map((band) => (
                  <span key={band.degree} className="layers-legend-row">
                    <i className="layers-sw" style={{ background: band.color }} aria-hidden="true" />
                    <b>{band.roman}</b>
                    <span>{t(`mmi.${band.degree}.damage` as DictKey)}</span>
                  </span>
                ))}
              </div>
            ) : null}

            {/* Non-negotiable. These contours are a model published minutes after the
                event and revised for days; presenting them as a damage survey would put
                someone on a road that is actually closed. */}
            <p className="layers-note">{t("layers.disclaimer")}</p>

            {state.stale ? <p className="layers-note">{t("layers.stale")}</p> : null}
            {!state.loading && state.quakes.length === 0 ? (
              <p className="layers-note">{t("layers.none", { n: SEISMIC.windowDays })}</p>
            ) : null}

            <p className="layers-src">{t("quake.source")}</p>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={`layersbtn${active ? " layersbtn-on" : ""}`}
        aria-expanded={open}
        aria-label={t("layers.cta")}
        title={t("layers.cta")}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon.layers />
      </button>
    </div>
  );
}
