"use client";

import { useEffect, useState } from "react";
import { useSite } from "@/features/app/SiteProvider";
import { INTENSITY_BANDS } from "@/domain/hazard";
import type { QuakeState } from "@/features/hazard/useQuakes";
import { Icon } from "@/ui/icons";
import SideTab from "@/ui/SideTab";
import { useI18n } from "@/i18n/context";
import type { DictKey, Translate } from "@/i18n";
import type { EmergencyLayer } from "@/domain/layers";
import { zoneAt, type AffectedZone } from "@/domain/area";

export interface HazardLayers {
  epicenters: boolean;
  intensity: boolean;
  /** Las zonas que declaró el equipo de esta emergencia. */
  zones: boolean;
}

/**
 * Cuándo llegó lo que se está mirando.
 *
 * La capa se refresca sola mientras la pantalla esté abierta (`useQuakes`), y hasta ahora
 * eso no se veía por ningún lado: un mapa que se actualiza y un mapa congelado se ven
 * exactamente igual. Durante una emergencia esa diferencia es la pregunta.
 *
 * En minutos y horas, no con la hora del reloj: "actualizado hace 3 min" se lee de un
 * vistazo y no obliga a restar.
 */
function freshness(t: Translate, at: number): string {
  const min = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (min < 1) return t("layers.updatedNow");
  if (min < 60) return t("layers.updatedMin", { n: min });
  return t("layers.updatedHours", { n: Math.floor(min / 60) });
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
  zones,
  here,
  onZoneOpen,
}: {
  layers: HazardLayers;
  onChange: (next: HazardLayers) => void;
  state: QuakeState;
  /** Overlays declared by this emergency (see `src/domain/layers.ts`). */
  extra: EmergencyLayer[];
  extraOn: Record<string, boolean>;
  onExtraChange: (next: Record<string, boolean>) => void;
  /** Zonas afectadas declaradas por esta emergencia. */
  zones: AffectedZone[];
  /**
   * Dónde está quien mira, si ya lo pidió. Sólo para contestarle si está dentro de una
   * zona, y ACÁ MISMO: esta coordenada no viaja a ninguna consulta ni a ninguna métrica.
   */
  here: { lat: number; lng: number } | null;
  /** Abrir la zona en la que se está: qué hay dentro. */
  onZoneOpen: (zone: AffectedZone) => void;
}) {
  const { t, lang } = useI18n();
  const SEISMIC = useSite().hazard.seismic;
  const [open, setOpen] = useState(false);

  // El rótulo de frescura envejece solo. Sin este latido diría "hace 2 min" durante media
  // hora, que es peor que no decir nada. Sólo mientras el panel está abierto: cerrado no
  // hay nadie leyéndolo y es un renderizado por minuto regalado.
  const [, retick] = useState(0);
  useEffect(() => {
    if (!open || state.updatedAt === null) return;
    const id = window.setInterval(() => retick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [open, state.updatedAt]);

  // El control desaparece solo si no hay NADA que ofrecer. Antes bastaba con que la capa
  // sísmica estuviera apagada, lo que habría escondido también las capas propias de una
  // emergencia que no es un terremoto — que son justo las que esa emergencia tiene.
  const anyExtra = extra.length > 0;
  const anyZone = zones.length > 0;
  if (!SEISMIC.enabled && !anyExtra && !anyZone) return null;

  /**
   * ¿Le tocó a quien está mirando?
   *
   * Se calcula acá, en su teléfono, con el polígono que ya está en memoria. Mandarle la
   * posición al servidor para que conteste lo mismo sería mandar la posición — y la
   * ubicación de una persona no sale de su teléfono.
   */
  const inside = here ? zoneAt(zones, here.lat, here.lng) : null;

  const active =
    layers.epicenters ||
    layers.intensity ||
    (anyZone && layers.zones) ||
    Object.values(extraOn).some(Boolean);
  // Only the bands this event actually reached. A legend running to "X — very heavy" on
  // a map whose worst contour is VI reads as a forecast of what is still coming.
  const reached = state.contours.length > 0 ? Math.max(...state.contours.map((c) => c.mmi)) : 0;
  // El suelo de 2 sólo tiene sentido cuando YA hay huella: sin contornos, `Math.max(0, 2)`
  // fabricaba una banda de la nada y la leyenda mostraba "II–III · Ninguno" — el pie de
  // una zona de sacudida que no existía. Sin contornos no hay leyenda.
  const bands =
    state.contours.length > 0
      ? INTENSITY_BANDS.filter((b) => b.degree >= 2 && b.degree <= Math.max(reached, 2))
      : [];

  /**
   * ¿Ofrecemos siquiera el interruptor de intensidad?
   *
   * Sólo si hay una huella que dibujar. USGS publica ShakeMap para eventos significativos
   * y para nada más, así que en la mayoría de los días de la mayoría de los despliegues no
   * hay ninguna — y un interruptor que no pinta nada se lee como que la aplicación falla,
   * o peor, como que la sacudida no llegó a ninguna parte.
   *
   * Es la misma regla que `config/features.ts` aplica a los módulos: se enciende cuando ya
   * existe el dato que lo sustenta, no antes. Vuelve solo en cuanto haya un sismo que USGS
   * modele.
   *
   * Condicionado a que la carga HAYA TERMINADO: durante los primeros segundos no hay
   * contornos todavía y sin esto el interruptor parpadearía al aparecer.
   */
  const canShowIntensity = state.loading || state.contours.length > 0;

  return (
    <SideTab
      className="layersctl"
      panelClassName="layers-panel"
      headClassName="layers-head"
      /* El rótulo corto: "Capas del mapa" estiraba la lengüeta a media pantalla. El
         nombre accesible sí es el largo — quien lo oye no ve la columna. */
      label={t("layers.cta")}
      title={t("layers.title")}
      icon={<Icon.layers />}
      active={active}
      open={open}
      onOpenChange={setOpen}
    >
      {/* Arriba del todo y no al pie, aunque al pie quedara junto a la fuente: a 390px el
          panel llega por detrás de la hoja inferior y el final no se ve. Esta línea es la
          que dice si lo de abajo está vivo, así que va donde se lee sin desplazar. */}
      {SEISMIC.enabled && state.updatedAt !== null ? (
        <p className="layers-fresh">{freshness(t, state.updatedAt)}</p>
      ) : null}

      {anyZone ? (
        <>
          <label className="layers-opt">
            <input
              type="checkbox"
              checked={layers.zones}
              onChange={(e) => onChange({ ...layers, zones: e.target.checked })}
            />
            <span className="layers-opt-ic">
              <Icon.layers />
            </span>
            <span className="layers-opt-txt">
              <b>{t("layers.zones")}</b>
              <small>{t("layers.zonesHint")}</small>
            </span>
          </label>

          {/* La respuesta directa, cuando se puede dar. Con icono y en texto: el color de
              la zona no puede ser lo único que diga si esto es grave. */}
          {inside ? (
            /* Un botón y no un párrafo: quien acaba de leer que está dentro de una zona
               grave tiene una segunda pregunta inmediata —qué hay aquí—, y la respuesta
               está a un toque. Dejarlo como aviso era obligar a buscar el rótulo en el
               mapa para llegar al mismo sitio. */
            <button
              type="button"
              className={`layers-inside layers-inside-s${inside.severity}`}
              onClick={() => {
                onZoneOpen(inside);
                setOpen(false);
              }}
            >
              <Icon.alert />
              <span>
                {t("area.youAreIn", { name: inside.label })}
                <i>{t(`area.sev.${inside.severity}` as DictKey)}</i>
              </span>
              <Icon.chevron />
            </button>
          ) : null}
        </>
      ) : null}

      {SEISMIC.enabled ? (
        <>
          {canShowIntensity ? (
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
          ) : null}

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
    </SideTab>
  );
}
