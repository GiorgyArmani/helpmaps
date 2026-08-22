"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// `MarkerClusterGroup` viene de @types/leaflet.markercluster, que AUMENTA el módulo
// "leaflet" en vez de exportar lo suyo. Este import es SOLO de tipos —no emite nada— para
// traer esa declaración sin arrastrar Leaflet al bundle del servidor: el plugin se carga
// en tiempo de ejecución dentro del efecto, después de Leaflet, como todo lo que toca
// `window`.
import type {} from "leaflet.markercluster";
import type {
  Map as LeafletMap,
  LayerGroup,
  DivIconOptions,
  MarkerClusterGroup,
} from "leaflet";
import "leaflet/dist/leaflet.css";
// Posicionamiento y animación de los grupos. NO se importa `MarkerCluster.Default.css`:
// ese es el aspecto por defecto del plugin, y acá el badge lo dibuja `clusterPinHtml`.
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Center } from "@/domain/types";
import type { IntensityContour, Quake } from "@/domain/hazard";
import type { GeoJsonObject } from "geojson";
import type { EmergencyLayer } from "@/domain/layers";
import { hasNeed, statusOf } from "@/domain/center";
import { MAPCFG, enabledTypes, typeStyle } from "@/config";
import { intensityBand } from "@/domain/hazard";
import { clusterPinHtml, glyphSvg } from "@/features/map/pinGlyphs";
import { alertColor, quakePopupHtml, quakeRadius } from "@/features/hazard/quakeMarkers";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { useSite, useSiteHelpers } from "@/features/app/SiteProvider";

interface Props {
  centers: Center[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Region code currently filtered; drives the viewport. */
  region: string | null;
  /** Seismic events to plot, already capped and ordered. */
  quakes: Quake[];
  /** MMI contours of the principal event — the affected zone. */
  contours: IntensityContour[];
  /** Which hazard overlays are switched on right now. */
  layers: { epicenters: boolean; intensity: boolean };
  /** Extra overlays this emergency declares, and which of them are switched on. */
  extra: EmergencyLayer[];
  extraOn: Record<string, boolean>;
  /** The point being placed in the staff form, or null when nothing is being edited. */
  draftPin: { lat: number; lng: number } | null;
  /** Fired when the draft pin is dragged, so the form's coordinates follow it. */
  onDraftPinMove: (at: { lat: number; lng: number }) => void;
}

/**
 * The map.
 *
 * Leaflet + OpenStreetMap: no API key, no quota, and no third party learning who is
 * looking for help. Leaflet is imported dynamically because it touches `window`.
 *
 * Markers are white pills with the type glyph, the treatment the original app arrived
 * at: they read as part of the map instead of as UI pasted over it, and they stay
 * legible over any tile colour. Names appear as haloed labels once you are zoomed in
 * enough that they do not collide.
 *
 * Clustering is a hand-rolled grid, not a plugin: at country zoom the only useful
 * question is "how much is around here", and a grid answers it in one pass over an
 * array already in memory.
 */
/**
 * GeoJSON de capas, cacheado por URL mientras dure la pestaña.
 *
 * Apagar y volver a encender una capa volvía a descargarla entera. Con el conjunto de
 * edificios dañados eso son 2,7 MB por cada vez que alguien duda y toca dos veces el
 * mismo interruptor, sobre la conexión que esta aplicación da por supuesta.
 *
 * Se guarda la PROMESA, no el resultado: dos capas que apunten al mismo archivo, o dos
 * clics seguidos, comparten una sola descarga en vuelo en vez de lanzar dos.
 */
const geoCache = new Map<string, Promise<GeoJsonObject>>();

function loadGeoJson(url: string): Promise<GeoJsonObject> {
  const hit = geoCache.get(url);
  if (hit) return hit;
  const pending = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<GeoJsonObject>;
  });
  // Un fallo no se cachea: la próxima vez que alguien lo encienda, se vuelve a intentar.
  pending.catch(() => geoCache.delete(url));
  geoCache.set(url, pending);
  return pending;
}

/** El zoom a partir del cual los pines tienen sitio para llevar su nombre al lado. */
const LABEL_ZOOM = 14;

/**
 * El pin de un punto: pastilla blanca, glifo del tipo, y el corazón si pide algo ahora.
 *
 * Extraído a una función para que la selección pueda repintar UN marcador sin reconstruir
 * la capa entera — que es lo que permite tener el índice por id.
 */
function pinIcon(center: Center, selected: boolean): DivIconOptions {
  const style = typeStyle(center.type);
  const closed = statusOf(center) === "cerrado";
  const needs = hasNeed(center) && !closed;
  return {
    className: "mkwrap",
    html:
      `<span class="mk${selected ? " mk-on" : ""}${closed ? " mk-closed" : ""}">` +
      `<span class="mkico" style="color:${selected ? "#fff" : style.color}">` +
      `${glyphSvg(style.icon, 12)}</span>` +
      // The heart marks a point that is asking for something right now: the map's whole
      // job is making that visible without a tap.
      (needs ? `<span class="mkn">${heart(selected ? "#fff" : "#c98a2e")}</span>` : "") +
      `</span>`,
    iconSize: [0, 0],
  };
}

export default function MapCanvas({
  centers,
  selectedId,
  onSelect,
  region,
  quakes,
  contours,
  layers,
  extra,
  extraOn,
  draftPin,
  onDraftPinMove,
}: Props) {
  const site = useSite();
  const helpers = useSiteHelpers();
  const { t, lang } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // Un grupo de clusters por tipo de punto. Se crean una vez, con el mapa.
  const clustersRef = useRef<Record<string, MarkerClusterGroup> | null>(null);
  // Los marcadores por id, para poder repintar solo el que cambió de selección en vez de
  // reconstruir los setecientos.
  const markersRef = useRef<Record<string, import("leaflet").Marker>>({});
  const labelsRef = useRef(false);
  // La selección pintada ahora mismo. `draw` la lee de acá en vez de depender de ella, para
  // no reconstruir la capa entera cada vez que alguien toca un pin.
  const selectedRef = useRef<string | null>(null);
  const hazardRef = useRef<LayerGroup | null>(null);
  // Las capas propias de la emergencia, montadas por id.
  const overlayRef = useRef<LayerGroup | null>(null);
  const mountedRef = useRef<Record<string, import("leaflet").Layer>>({});
  const meRef = useRef<import("leaflet").Marker | null>(null);
  const draftRef = useRef<import("leaflet").Marker | null>(null);
  const selectRef = useRef(onSelect);
  // Same trick as `selectRef`: the drag handler is bound once when the marker is built,
  // so it has to read the CURRENT callback rather than the one captured that render.
  const draftMoveRef = useRef(onDraftPinMove);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(false);

  // Kept in a ref so a marker's click handler always calls the CURRENT callback without
  // every marker being torn down and rebuilt when the parent re-renders.
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    draftMoveRef.current = onDraftPinMove;
  }, [onDraftPinMove]);

  // ── init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      map = L.map(containerRef.current, {
        center: site.country.geo.center,
        zoom: site.country.geo.zoom,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer(MAPCFG.tiles.url, {
        attribution: MAPCFG.tiles.attribution,
        subdomains: MAPCFG.tiles.subdomains ?? "abc",
        maxZoom: MAPCFG.tiles.maxZoom,
      }).addTo(map);
      // Drop Leaflet's own "Leaflet" prefix: the tile licence attribution stays, the
      // library plug does not need the pixels on a phone.
      map.attributionControl.setPrefix("");

      // Added BEFORE the pin layer so the seismic overlay paints underneath it. The
      // shaking is context; the shelters are the answer, and the answer stays on top.
      // Orden de pintado, de abajo hacia arriba: mapa base, capas de la emergencia, capa
      // sísmica, pines. El temblor y los daños son contexto; los puntos de ayuda son la
      // respuesta, y la respuesta va siempre encima.
      overlayRef.current = L.layerGroup().addTo(map);
      hazardRef.current = L.layerGroup().addTo(map);

      // El plugin se carga después de Leaflet porque se engancha a su namespace.
      await import("leaflet.markercluster");

      const groups: Record<string, MarkerClusterGroup> = {};
      for (const type of enabledTypes()) {
        groups[type] = L.markerClusterGroup({
          chunkedLoading: true,
          maxClusterRadius: 55,
          showCoverageOnHover: false,
          // Dos puntos exactamente encima se abren en abanico al máximo zoom, en vez de
          // dejar uno inalcanzable debajo del otro.
          spiderfyOnMaxZoom: true,
          // Respeta `config/map.ts`: por debajo de ese zoom se agrupa, a partir de ahí no.
          disableClusteringAtZoom: MAPCFG.cluster.enabled ? MAPCFG.cluster.maxZoom : 0,
          iconCreateFunction: (cluster) =>
            L.divIcon({
              className: "mkwrap",
              html: clusterPinHtml(type, cluster.getChildCount()),
              iconSize: [0, 0],
            }),
        }).addTo(map);
      }
      clustersRef.current = groups;

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      clustersRef.current = null;
      markersRef.current = {};
      hazardRef.current = null;
      overlayRef.current = null;
      mountedRef.current = {};
    };
  }, []);

  // ── seismic overlay ─────────────────────────────────────────────────────
  //
  // Redrawn wholesale whenever the data or the toggles change. There is at most a
  // handful of epicentres and seven contour bands, so clearing and rebuilding costs
  // nothing measurable and removes a whole class of "layer left behind" bugs.
  useEffect(() => {
    if (!ready) return;
    const layer = hazardRef.current;
    if (!layer) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !hazardRef.current) return;
      layer.clearLayers();

      // Weakest contour first (the fetch already sorts them), so the strong inner bands
      // paint over the weak outer ones where they crowd together near the epicentre.
      if (layers.intensity) {
        for (const contour of contours) {
          const band = intensityBand(contour.mmi);
          const line = L.polyline(contour.lines, {
            color: contour.color,
            weight: contour.mmi % 1 === 0 ? 2.5 : 1.5,
            opacity: 0.95,
            // Never intercept a click meant for a pin underneath the footprint.
            interactive: false,
          });
          line.addTo(layer);

          // A bare coloured line means nothing without its degree, and a 2px contour is
          // far too thin to hover. So the same path is drawn again, fat and invisible,
          // purely as a hit target. `transparent` rather than `opacity: 0` on purpose:
          // Leaflet hit-tests paths as `visiblePainted`, which asks whether `stroke` is
          // `none` — a transparent stroke is still painted, a zero-opacity one is not
          // reliably so across browsers.
          L.polyline(contour.lines, {
            color: "transparent",
            weight: 12,
          })
            .bindTooltip(
              `${t("mmi.scale")} ${band.roman} · ${t(`mmi.${band.degree}.damage` as DictKey)}`,
              { sticky: true, className: "qk-tip" },
            )
            .addTo(layer);
        }
      }

      if (layers.epicenters) {
        for (const quake of quakes) {
          const color = alertColor(quake);
          L.circleMarker([quake.lat, quake.lng], {
            radius: quakeRadius(quake.magnitude),
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.22,
          })
            .bindPopup(quakePopupHtml(quake, t, lang), { className: "qk-pop", maxWidth: 280 })
            .addTo(layer);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, quakes, contours, layers.intensity, layers.epicenters, t, lang]);

  // ── capas propias de la emergencia ──────────────────────────────────────
  //
  // Se montan y desmontan por id en vez de redibujarse en bloque como la capa sísmica: una
  // de GeoJSON puede pesar megabytes y descargarla otra vez cada vez que alguien enciende
  // otra distinta sería pagarla varias veces sobre la conexión de un teléfono.
  //
  // Una capa que no responde se registra y se ignora. Ninguna de estas es la razón por la
  // que alguien abrió el mapa: si el satélite no contesta, los refugios se siguen viendo.
  useEffect(() => {
    if (!ready) return;
    const group = overlayRef.current;
    if (!group) return;
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !overlayRef.current) return;

      // Apagar lo que ya no corresponde, incluidas las capas que la emergencia dejó de
      // declarar entre dos guardados de la consola.
      for (const [id, layer] of Object.entries(mountedRef.current)) {
        const declared = extra.find((l) => l.id === id);
        if (!declared || !extraOn[id]) {
          group.removeLayer(layer);
          delete mountedRef.current[id];
        }
      }

      for (const spec of extra) {
        if (!extraOn[spec.id] || mountedRef.current[spec.id]) continue;

        if (spec.kind === "tiles") {
          const layer = L.tileLayer(spec.url, {
            attribution: spec.attribution || undefined,
            opacity: spec.opacity ?? 0.75,
            maxZoom: spec.maxZoom ?? MAPCFG.tiles.maxZoom,
          });
          if (cancelled) return;
          mountedRef.current[spec.id] = layer;
          layer.addTo(group);
          continue;
        }

        try {
          const data = await loadGeoJson(spec.url);
          if (cancelled || !extraOn[spec.id] || mountedRef.current[spec.id]) return;
          const color = spec.color ?? "#b3261e";
          const layer = L.geoJSON(data, {
            attribution: spec.attribution || undefined,
            style: () => ({ color, weight: 1.5, opacity: 0.9, fillColor: color, fillOpacity: 0.25 }),
            // Los puntos se dibujan como círculos, no como marcadores.
            //
            // Por defecto `L.geoJSON` convierte cada Point en un `L.Marker`, que pide el
            // icono PNG que Leaflet trae — la imagen que todo empaquetador rompe, y que
            // aquí se veía como una tanda de 404 y ningún punto en pantalla. Un círculo
            // además no compite con los pines de ayuda, que son los que importan.
            pointToLayer: (_feature, latlng) =>
              L.circleMarker(latlng, {
                radius: 5,
                color,
                weight: 1.5,
                opacity: 0.9,
                fillColor: color,
                fillOpacity: 0.35,
              }),
            // Nunca intercepta un clic destinado a un pin que esté debajo.
            interactive: false,
          });
          mountedRef.current[spec.id] = layer;
          layer.addTo(group);
        } catch (err) {
          console.error(`[capa ${spec.id}] no se pudo cargar:`, err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, extra, extraOn]);

  // ── markers ─────────────────────────────────────────────────────────────
  //
  // ── ONE CLUSTER GROUP PER POINT TYPE ────────────────────────────────────
  //
  // The clustering used to be a hand-rolled grid recomputed on every `zoomend`, which
  // meant rebuilding every marker's DOM node each time the wheel moved. At the scale this
  // is heading for — AcopioVE runs seven hundred points — that stutters on a phone, which
  // is the device this application exists for.
  //
  // It is now `leaflet.markercluster`, which keeps only what is on screen in the DOM and
  // inserts in chunks. What is NOT inherited from that plugin is its usual look: one group
  // per type, so a cluster's colour is still the point type and never has to average two
  // answers to two different questions into one badge. That was already the intent here —
  // `clusterPinHtml` fans the type badges apart precisely so several can share a spot — it
  // just had to be implemented by hand to get it.
  const draw = useCallback(async () => {
    const map = mapRef.current;
    const groups = clustersRef.current;
    if (!map || !groups) return;
    const L = (await import("leaflet")).default;

    // Labels only once the pins have room; below that they overlap into noise.
    const withLabels = map.getZoom() >= LABEL_ZOOM;
    labelsRef.current = withLabels;
    markersRef.current = {};

    const pending: Record<string, import("leaflet").Marker[]> = {};

    for (const center of centers) {
      const marker = L.marker([center.lat, center.lng], {
        icon: L.divIcon(pinIcon(center, center.id === selectedRef.current)),
        title: center.name,
        alt: center.name,
        riseOnHover: true,
      });
      marker.on("click", () => selectRef.current(center.id));
      if (withLabels) {
        marker.bindTooltip(center.name, {
          permanent: true,
          direction: "right",
          className: "mklabel",
          offset: [8, 0],
        });
      }
      markersRef.current[center.id] = marker;
      (pending[center.type] ??= []).push(marker);
    }

    // Cleared and refilled per type, in bulk: `addLayers` on an array is what makes the
    // plugin worth having over adding markers one at a time.
    for (const [type, group] of Object.entries(groups)) {
      group.clearLayers();
      const batch = pending[type];
      if (batch?.length) group.addLayers(batch);
    }
  }, [centers]);

  useEffect(() => {
    if (!ready) return;
    void draw();
  }, [ready, draw]);

  // Redrawn only when the label threshold is actually CROSSED, not on every zoom step.
  // The plugin owns the clustering now, so zooming no longer needs to rebuild anything —
  // except the permanent tooltips, which exist above one zoom level and not below it.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => {
      if (map.getZoom() >= LABEL_ZOOM !== labelsRef.current) void draw();
    };
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [ready, draw]);

  // ── the point being placed in the staff form ────────────────────────────
  //
  // Draggable, and it is the cheapest correct way to fine-tune a location: no geocoder
  // resolves "the school behind the church" but anyone can drag a pin fifty metres onto
  // the right roof. The marker is created once and then MOVED, so a drag is never
  // interrupted by the re-render its own `dragend` causes.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    if (!draftPin) {
      draftRef.current?.remove();
      draftRef.current = null;
      return;
    }

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      if (!draftRef.current) {
        draftRef.current = L.marker([draftPin.lat, draftPin.lng], {
          draggable: true,
          autoPan: true,
          keyboard: false,
          zIndexOffset: 1000,
          icon: L.divIcon({
            className: "mkwrap",
            html: `<span class="mkdraft"></span>`,
            iconSize: [0, 0],
          }),
        }).addTo(map);
        draftRef.current.on("dragend", (e) => {
          const { lat, lng } = (e.target as import("leaflet").Marker).getLatLng();
          draftMoveRef.current({ lat, lng });
        });
        map.flyTo([draftPin.lat, draftPin.lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
        return;
      }

      // Typed into the form rather than dragged: move the pin to match, but leave the
      // viewport alone while a drag is in flight or the pin would slide out from under
      // the cursor.
      const at = draftRef.current.getLatLng();
      if (Math.abs(at.lat - draftPin.lat) > 1e-7 || Math.abs(at.lng - draftPin.lng) > 1e-7) {
        draftRef.current.setLatLng([draftPin.lat, draftPin.lng]);
        if (!map.getBounds().contains([draftPin.lat, draftPin.lng])) {
          map.panTo([draftPin.lat, draftPin.lng], { animate: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, draftPin]);

  // ── viewport follows the region filter ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!region) {
      map.flyTo(site.country.geo.center, site.country.geo.zoom, { duration: 0.6 });
      return;
    }
    const r = helpers.regionByCode(region);
    if (r) map.flyTo([r.lat, r.lng], r.zoom ?? site.country.geo.regionZoom, { duration: 0.6 });
  }, [region, ready]);

  // ── centre on the selected point ────────────────────────────────────────
  // Repinta SOLO el pin que se deselecciona y el que se selecciona.
  //
  // Antes esto era una dependencia de `draw`, así que cada clic reconstruía los setecientos
  // marcadores para cambiarle el color a uno. Con el índice por id son dos llamadas a
  // `setIcon`, y el mapa no parpadea.
  useEffect(() => {
    if (!ready) return;
    const previous = selectedRef.current;
    selectedRef.current = selectedId;
    if (previous === selectedId) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      const repaint = (id: string | null, on: boolean) => {
        if (!id) return;
        const marker = markersRef.current[id];
        const center = centers.find((c) => c.id === id);
        if (marker && center) marker.setIcon(L.divIcon(pinIcon(center, on)));
      };
      repaint(previous, false);
      repaint(selectedId, true);
    })();
  }, [ready, selectedId, centers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;
    const c = centers.find((x) => x.id === selectedId);
    if (!c) return;
    map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
  }, [selectedId, centers, ready]);

  // ── my location ─────────────────────────────────────────────────────────
  // A denied or unavailable fix has to SAY so. Silently dropping back to the idle state
  // reads as a dead button, and the usual cause — permission denied, or an insecure
  // origin, where the callback never fires at all — is something only the user can fix.
  const locate = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) {
      setLocateError(true);
      return;
    }
    setLocateError(false);
    setLocating(true);
    const L = (await import("leaflet")).default;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        meRef.current?.remove();
        meRef.current = L.marker(here, {
          icon: L.divIcon({ className: "mkwrap", html: `<span class="me"></span>`, iconSize: [0, 0] }),
          interactive: false,
        }).addTo(map);
        map.flyTo(here, 14, { duration: 0.6 });
      },
      () => {
        setLocating(false);
        setLocateError(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return (
    <>
      <div ref={containerRef} className="map" role="application" aria-label="Mapa" />

      {MAPCFG.userLocation ? (
        <div className="locatectl">
          <button
            type="button"
            className={`locatebtn${locating ? " locatebtn-on" : ""}`}
            onClick={() => void locate()}
            disabled={locating}
            aria-label={locating ? t("map.locating") : t("map.myLocation")}
            title={locating ? t("map.locating") : t("map.myLocation")}
          >
            <Icon.target />
          </button>
          {locateError ? (
            <p className="locate-err" role="status">
              {t("map.locationDenied")}
              <button
                type="button"
                className="locate-errx"
                aria-label={t("common.close")}
                onClick={() => setLocateError(false)}
              >
                ✕
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Desktop only (see globals.css): phones pinch-zoom with fingers. */}
      <div className="zoomctl">
        <button
          type="button"
          className="zbtn"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label={t("map.zoomIn")}
        >
          <Icon.plus />
        </button>
        <button
          type="button"
          className="zbtn"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label={t("map.zoomOut")}
        >
          <Icon.minus />
        </button>
      </div>
    </>
  );
}

function heart(color: string): string {
  return (
    `<svg viewBox="0 0 24 24" width="11" height="11" fill="${color}" aria-hidden="true">` +
    `<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/></svg>`
  );
}

