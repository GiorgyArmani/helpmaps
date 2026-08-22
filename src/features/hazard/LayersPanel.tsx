"use client";

import { useState } from "react";
import { useSite } from "@/features/app/SiteProvider";
import { INTENSITY_BANDS } from "@/domain/hazard";
import type { QuakeState } from "@/features/hazard/useQuakes";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import type { EmergencyLayer } from "@/domain/layers";

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
  extra,
  extraOn,
  onExtraChange,
}: {
  layers: HazardLayers;
  onChange: (next: HazardLayers) => void;
  state: QuakeState;
  /** Overlays declared by this emergency (see `src/domain/layers.ts`). */
  extra: EmergencyLayer[];
  extraOn: Record<string, boolean>;
  onExtraChange: (next: Record<string, boolean>) => void;
}) {
  const { t, lang } = useI18n();
  const SEISMIC = useSite().hazard.seismic;
  const [open, setOpen] = useState(false);

  // El control desaparece solo si no hay NADA que ofrecer. Antes bastaba con que la capa
  // sísmica estuviera apagada, lo que habría escondido también las capas propias de una
  // emergencia que no es un terremoto — que son justo las que esa emergencia tiene.
  const anyExtra = extra.length > 0;
  if (!SEISMIC.enabled && !anyExtra) return null;

  const active =
    layers.epicenters || layers.intensity || Object.values(extraOn).some(Boolean);
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

            {SEISMIC.enabled ? (
              <>
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
              </>
            ) : null}

            {extra.map((layer) => (
              <label key={layer.id} className="layers-opt">
                <input
                  type="checkbox"
                  checked={extraOn[layer.id] ?? false}
                  onChange={(e) => onExtraChange({ ...extraOn, [layer.id]: e.target.checked })}
                />
                <span className="layers-opt-ic">
                  <Icon.layers />
                </span>
                <span className="layers-opt-txt">
                  <b>{layer.label}</b>
                  {layer.hint ? <small>{layer.hint}</small> : null}
                </span>
              </label>
            ))}

            {/* La atribución es condición de licencia de casi toda fuente que valga la
                pena, no cortesía. Se muestra mientras la capa esté encendida. */}
            {extra
              .filter((l) => extraOn[l.id] && l.attribution)
              .map((l) => (
                <p key={`src-${l.id}`} className="layers-src">
                  {l.attribution}
                </p>
            ))}

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

            {/* Los últimos sismos del catálogo, al final del panel.
                La leyenda de arriba dice qué SIGNIFICAN los colores; esto dice qué PASÓ,
                que es la otra mitad de la pregunta y estaba solo en AcopioVE. Se listan
                los más fuertes primero: en una lista de treinta réplicas, el orden
                cronológico entierra justamente el que importa. */}
            {state.quakes.length > 0 ? (
              <div className="layers-quakes">
                <span className="layers-legend-h">{t("layers.recent")}</span>
                {[...state.quakes]
                  .sort((a, b) => b.magnitude - a.magnitude)
                  .slice(0, 6)
                  .map((q) => (
                    <span key={`${q.lat},${q.lng},${q.time}`} className="layers-quake">
                      <b>{q.magnitude.toFixed(1)}</b>
                      <span className="layers-quake-p">{q.place}</span>
                      <time dateTime={new Date(q.time).toISOString()}>
                        {new Date(q.time).toLocaleDateString(lang, {
                          day: "2-digit",
                          month: "short",
                        })}
                      </time>
                    </span>
                  ))}
              </div>
            ) : null}

            <p className="layers-src">{t("quake.source")}</p>
          </div>
        </>
      ) : null}

      {/* Pestaña pegada al borde, no un botón flotante.
          Es el gesto de AcopioVE y resuelve algo que el botón redondo no: dice QUÉ hay
          detrás sin abrirlo. Un icono de capas sobre un mapa no distingue "capas del
          mapa" de "cambiar el mapa base", y quien no lo abre nunca se entera de que hay
          una capa sísmica encendida. */}
      {!open ? (
        <button
          type="button"
          className={`sidetab${active ? " sidetab-on" : ""}`}
          aria-expanded={false}
          aria-label={t("layers.cta")}
          title={t("layers.cta")}
          onClick={() => setOpen(true)}
        >
          <Icon.chevron className="sidetab-ch" />
          {/* El rótulo corto: "Capas del mapa" estiraba la lengüeta a media pantalla. */}
          <span className="sidetab-txt">{t("layers.cta")}</span>
        </button>
      ) : null}
    </div>
  );
}
