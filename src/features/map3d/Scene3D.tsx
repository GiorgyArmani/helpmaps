"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { EmergencyLayer } from "@/domain/layers";

/**
 * Un punto del mapa, reducido a lo que la escena necesita.
 *
 * Deliberadamente NO es `Center`: la escena no muestra teléfonos, ni horarios, ni
 * necesidades, y arrastrar el objeto entero hasta acá son 520 fichas completas cruzando el
 * límite servidor→cliente para dibujar 520 círculos.
 */
export interface ScenePoint {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  /** El color del tipo, resuelto en el servidor: `typeStyle` vive en la configuración. */
  color: string;
}
import { Icon } from "@/ui/icons";
import { Notice, Spinner } from "@/ui/primitives";
import { useI18n } from "@/i18n/context";
import SideTab from "@/ui/SideTab";

/**
 * The 3D scene.
 *
 * ── IT DRAWS WHAT THE EMERGENCY DECLARES, NOT A FIXED LIST ──────────────────
 *
 * AcopioVE's 3D view carries eighteen layers hardcoded into the component: the damaged
 * buildings of Catia La Mar, this earthquake's ShakeMap, the 1967 one, rain, alerts, and
 * seven feeds of people. Ported as-is that is eighteen switches wired to Venezuela, and
 * seventeen of them would be dead in any other deployment — which is exactly the "switch
 * that is on and wired to nothing" this project warns about in `config/features.ts`.
 *
 * So the scene renders the SAME `layers` array the 2D map reads (`src/domain/layers.ts`).
 * A deployment gets the layers it declares, and Venezuela declares the ones AcopioVE
 * publishes. Adding one is a row edit, not a release.
 *
 * ── WHAT THE HEIGHT MEANS, AND WHY IT HAS TO BE SAID ────────────────────────
 *
 * For `buildings3d` the extrusion is the DAMAGE estimate, not the building's real height.
 * A tall block here is a badly damaged one, and without the legend saying so the scene
 * reads as a skyline — which would make an intact tower look like the worst news on the
 * map. The legend is not optional chrome and does not collapse.
 */

type Toggles = Record<string, boolean>;

export default function Scene3D({
  layers,
  fallbackCenter,
  centers,
}: {
  layers: EmergencyLayer[];
  /**
   * Dónde abrir la escena cuando no hay conjunto de edificios que la encuadre.
   *
   * En orden **[lng, lat]**, el de MapLibre — NO el `[lat, lng]` de `country.geo.center`,
   * que es el de Leaflet porque lo consume el mapa 2D. Quien llama hace la conversión, y
   * `app/3d/page.tsx` la hace con el porqué al lado.
   *
   * Se dice acá porque el error es mudo: pasarlo al revés no lanza nada, no avisa de nada
   * y abre la escena en mitad del océano Antártico. Se ve exactamente igual que "el mapa
   * 3D no funciona".
   */
  fallbackCenter: [number, number];
  /**
   * Los puntos del mapa 2D, para verlos sobre el relieve.
   *
   * Es lo que hace que esta escena valga la pena sin un conjunto de edificios: con el
   * terreno encendido se ve qué refugios están en ladera y cuáles en el valle, que en este
   * país es media explicación de por dónde bajó el agua.
   */
  centers?: ScenePoint[];
}) {
  const { t } = useI18n();
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const mounted = useRef<Set<string>>(new Set());

  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [panelOpen, setPanelOpen] = useState(false);
  const [flat, setFlat] = useState(false);
  const [terrain, setTerrain] = useState(false);
  // Encendidos de entrada: son la razón por la que la mayoría abre esta escena.
  const [showPoints, setShowPoints] = useState(true);
  const [on, setOn] = useState<Toggles>(() =>
    Object.fromEntries(layers.map((l) => [l.id, l.defaultOn])),
  );

  // La escena se abre sobre el conjunto de edificios si lo hay: es lo que la hace 3D.
  const anchor = useMemo(() => {
    const buildings = layers.find((l) => l.kind === "buildings3d");
    const focused = buildings?.center ?? layers.find((l) => l.center)?.center;
    return {
      center: focused ?? fallbackCenter,
      // 15 encuadra una manzana, que es lo que pide un conjunto de edificios. Sin él la
      // escena es la del país entero y ese zoom deja fuera todo menos una esquina.
      zoom: focused ? buildings?.zoom ?? 15 : 7,
    };
  }, [layers, fallbackCenter]);

  const buildings = useMemo(() => layers.filter((l) => l.kind === "buildings3d"), [layers]);

  // ── mapa ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !holder.current || mapRef.current) return;

      const map = new maplibre.Map({
        container: holder.current,
        // OpenFreeMap: sin clave ni cuota, como el mapa base del resto de la aplicación.
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: anchor.center,
        zoom: anchor.zoom,
        pitch: 60,
        bearing: -20,
        attributionControl: { compact: false },
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), "bottom-right");

      // MapLibre mide el contenedor UNA vez, al construirse, y no vuelve a mirarlo: sin
      // esto el lienzo se queda con la altura provisional que tenía antes del layout y la
      // escena sale correcta pero recortada a una franja.
      const observer = new ResizeObserver(() => map.resize());
      observer.observe(holder.current);
      cleanupRef.current = () => observer.disconnect();

      // Tres caminos al mismo interruptor, y hacen falta los tres.
      //
      // Con solo `load` la escena se quedaba con el indicador de carga puesto para
      // siempre y NINGUNA capa llegaba a montarse: se veían los edificios genéricos del
      // mapa base y ni rastro de los dañados. `idle` cubre el caso de que el evento se
      // haya disparado antes de que este código llegue a escucharlo, y la comprobación
      // directa cubre que el estilo ya estuviera en caché del navegador.
      const markReady = () => {
        if (!cancelled) setReady(true);
      };
      if (map.isStyleLoaded()) markReady();
      map.on("load", markReady);
      map.on("idle", markReady);
    })();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      mounted.current = new Set();
    };
  }, [anchor]);

  // ── capas ───────────────────────────────────────────────────────────────
  const sync = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !ready) return;

    for (const layer of layers) {
      const want = on[layer.id] === true;
      const has = mounted.current.has(layer.id);
      if (want === has) continue;

      if (!want) {
        removeLayer(map, layer.id);
        mounted.current.delete(layer.id);
        continue;
      }

      try {
        await addLayer(map, layer);
        mounted.current.add(layer.id);
        setErrors((e) => {
          if (!e[layer.id]) return e;
          const next = { ...e };
          delete next[layer.id];
          return next;
        });
      } catch (err) {
        // Una capa que no responde se anota y se sigue. Ninguna de estas es la razón por
        // la que alguien abrió la escena.
        setErrors((e) => ({
          ...e,
          [layer.id]: err instanceof Error ? err.message.slice(0, 90) : "error",
        }));
      }
    }
  }, [layers, on, ready]);

  useEffect(() => {
    void sync();
  }, [sync]);

  // ── los puntos del mapa ─────────────────────────────────────────────────
  //
  // Círculos y no columnas extruidas, que es lo primero que uno intenta: una extrusión se
  // mide en METROS, así que a zoom de país una columna de 500 m ocupa menos de un píxel y
  // la escena parece vacía. El radio de un círculo se mide en píxeles y se ve igual de
  // bien encuadrando el país que una manzana.
  //
  // `circle-pitch-alignment: "map"` es lo que los hace tridimensionales de verdad: en vez
  // de quedarse mirando a la cámara como una chincheta, se tumban sobre el suelo y siguen
  // la inclinación y el relieve. Con el terreno encendido, un punto en ladera se ve en
  // ladera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const SRC = "scene-points";
    const LYR = "scene-points-dots";

    if (!showPoints || !centers || centers.length === 0) {
      if (map.getLayer(LYR)) map.removeLayer(LYR);
      if (map.getSource(SRC)) map.removeSource(SRC);
      return;
    }

    const data = {
      type: "FeatureCollection" as const,
      features: centers.map((c) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
        properties: { name: c.name, color: c.color, type: c.type },
      })),
    };

    const existing = map.getSource(SRC);
    if (existing && "setData" in existing) {
      (existing as { setData: (d: unknown) => void }).setData(data);
      return;
    }

    map.addSource(SRC, { type: "geojson", data });
    map.addLayer({
      id: LYR,
      type: "circle",
      source: SRC,
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 6, 15, 11],
        // El borde blanco es lo que separa dos puntos vecinos del mismo tipo, y lo que los
        // despega de un terreno oscuro.
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#fff",
        "circle-pitch-alignment": "map",
      },
    });
  }, [centers, showPoints, ready]);

  // ── relieve del terreno ─────────────────────────────────────────────────
  //
  // DEM público de AWS en codificación "terrarium": sin clave ni cuota, igual que el
  // mapa base. Con la exageración a 1.5 el litoral se lee como litoral — el cerro que
  // tiene detrás Catia La Mar es la mitad de la explicación de por dónde bajó el agua.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const ID = "terrain-dem";

    if (terrain) {
      if (!map.getSource(ID)) {
        map.addSource(ID, {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          tileSize: 256,
          encoding: "terrarium",
          maxzoom: 15,
        });
      }
      map.setTerrain({ source: ID, exaggeration: 1.5 });
    } else {
      map.setTerrain(null);
    }
  }, [terrain, ready]);

  // ── plano / 3D ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.easeTo({ pitch: flat ? 0 : 60, bearing: flat ? 0 : -20, duration: 450 });
  }, [flat, ready]);

  const anyOn = Object.values(on).some(Boolean);

  return (
    <div className="scene3d">
      <div ref={holder} className="scene3d-map" />

      {!ready ? (
        <div className="scene3d-loading" aria-hidden="true">
          <Spinner />
        </div>
      ) : null}

      {/* Los controles de vista, en su propia columna a la izquierda: cambian cómo se
          MIRA la escena, mientras las capas de la derecha cambian QUÉ se muestra. Son dos
          preguntas distintas y estaban en el mismo sitio. */}
      <div className="scene3d-tools">
        <button
          type="button"
          className={`s3btn${!flat ? " s3btn-on" : ""}`}
          onClick={() => setFlat((v) => !v)}
          aria-pressed={!flat}
          title={flat ? t("scene3d.tilt") : t("scene3d.flat")}
        >
          <span className="s3btn-txt">{flat ? "3D" : "2D"}</span>
        </button>

        <button
          type="button"
          className={`s3btn${terrain ? " s3btn-on" : ""}`}
          onClick={() => setTerrain((v) => !v)}
          aria-pressed={terrain}
          title={t("scene3d.terrain")}
        >
          <Icon.waves />
        </button>

        {/* Apagar los puntos deja la escena limpia para mirar el relieve o una capa de
            daños. Va con los otros dos porque cambia cómo se MIRA, no qué datos hay. */}
        {centers && centers.length > 0 ? (
          <button
            type="button"
            className={`s3btn${showPoints ? " s3btn-on" : ""}`}
            onClick={() => setShowPoints((v) => !v)}
            aria-pressed={showPoints}
            title={t("scene3d.points")}
          >
            <Icon.target />
          </button>
        ) : null}
      </div>

      {layers.length > 0 ? (
        <SideTab
          className={`layersctl scene3d-layers${panelOpen ? " is-open" : ""}`}
          panelClassName="layers-panel"
          headClassName="layers-head"
          label={t("layers.cta")}
          title={t("layers.title")}
          active={anyOn}
          open={panelOpen}
          onOpenChange={setPanelOpen}
        >
          {layers.map((layer) => (
            <label key={layer.id} className="layers-opt">
              <input
                type="checkbox"
                checked={on[layer.id] ?? false}
                onChange={(e) => setOn((s) => ({ ...s, [layer.id]: e.target.checked }))}
              />
              <span className="layers-opt-ic">
                <Icon.layers />
              </span>
              <span className="layers-opt-txt">
                <b>{layer.label}</b>
                {errors[layer.id] ? (
                  <small className="layers-err">{t("scene3d.layerError")}</small>
                ) : layer.hint ? (
                  <small>{layer.hint}</small>
                ) : null}
              </span>
            </label>
          ))}

          {layers
            .filter((l) => on[l.id] && l.attribution)
            .map((l) => (
              <p key={`src-${l.id}`} className="layers-src">
                {l.attribution}
              </p>
            ))}
        </SideTab>
      ) : null}

      {buildings.some((b) => on[b.id]) ? (
        <div className="scene3d-legend">
          <b>{t("scene3d.legendTitle")}</b>
          <span>{t("scene3d.legendBody")}</span>
          <div className="scene3d-ramp" aria-hidden="true">
            <i style={{ background: "#8fbf9f" }} />
            <i style={{ background: "#e8c46a" }} />
            <i style={{ background: "#e08b4c" }} />
            <i style={{ background: "#b3261e" }} />
          </div>
          <div className="scene3d-ramp-lbl">
            <span>{t("scene3d.less")}</span>
            <span>{t("scene3d.more")}</span>
          </div>
        </div>
      ) : null}

      {Object.keys(errors).length > 0 ? (
        <div className="scene3d-error">
          <Notice tone="warn">
            {t("scene3d.layersError", {
              layers: layers
                .filter((l) => errors[l.id])
                .map((l) => l.label)
                .join(", "),
            })}
          </Notice>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Añadir y quitar capas
// ---------------------------------------------------------------------------

/**
 * Every layer id derived from one declaration, so removing is exact.
 *
 * A GeoJSON source gets three render layers — fill, line and circle — because a feed can
 * carry polygons, lines and points in the same collection (the ShakeMap contours do), and
 * MapLibre applies each layer type only to the geometries it fits. Guessing one type would
 * silently drop the rest.
 */
function ids(id: string) {
  return { src: `emg-${id}`, fill: `emg-${id}-fill`, line: `emg-${id}-line`, circle: `emg-${id}-circle` };
}

async function addLayer(map: MapLibreMap, layer: EmergencyLayer): Promise<void> {
  const k = ids(layer.id);
  const color = layer.color ?? "#b3261e";

  if (layer.kind === "tiles") {
    map.addSource(k.src, { type: "raster", tiles: [layer.url], tileSize: 256 });
    map.addLayer({
      id: k.fill,
      type: "raster",
      source: k.src,
      paint: { "raster-opacity": layer.opacity ?? 0.7 },
    });
    return;
  }

  const res = await fetch(layer.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  map.addSource(k.src, { type: "geojson", data });

  if (layer.kind === "buildings3d") {
    const prop = layer.heightProperty ?? "damage";
    const max = layer.valueMax ?? 100;
    const metres = layer.heightScale ?? 45;

    // Se normaliza a 0–1 ANTES de usarlo para la altura y para el color, porque los
    // conjuntos no coinciden en escala y el archivo no dice cuál usa: el de Catia La Mar
    // guarda fracciones (0.451) y otro guardaría 45.1 en el mismo campo. Sin normalizar,
    // uno de los dos sale con edificios de centímetros y la rampa clavada en su primer
    // tramo — mal, pero renderizando, que es la peor forma de estar mal.
    const norm: ExpressionSpecification = ["/", ["coalesce", ["get", prop], 0], max];

    map.addLayer({
      id: k.fill,
      type: "fill-extrusion",
      source: k.src,
      paint: {
        "fill-extrusion-height": ["*", norm, metres],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.85,
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          norm,
          0, "#8fbf9f",
          0.4, "#e8c46a",
          0.7, "#e08b4c",
          1, color,
        ],
      },
    });
    return;
  }

  // `coalesce` sobre una propiedad `color` de la propia entidad: los contornos de
  // ShakeMap traen su color por banda de intensidad, y pintarlos todos del mismo tono
  // borraría justamente lo que distingue una banda de otra.
  const paintColor: ExpressionSpecification = ["coalesce", ["get", "color"], color];

  map.addLayer({
    id: k.fill,
    type: "fill",
    source: k.src,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": paintColor, "fill-opacity": 0.35 },
  });
  map.addLayer({
    id: k.line,
    type: "line",
    source: k.src,
    filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
    paint: { "line-color": paintColor, "line-width": 1.6, "line-opacity": 0.85 },
  });
  map.addLayer({
    id: k.circle,
    type: "circle",
    source: k.src,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 6,
      "circle-color": paintColor,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
    },
  });
}

function removeLayer(map: MapLibreMap, id: string): void {
  const k = ids(id);
  for (const layerId of [k.fill, k.line, k.circle]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(k.src)) map.removeSource(k.src);
}
