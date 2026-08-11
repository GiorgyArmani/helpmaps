"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Center } from "@/domain/types";
import type { IntensityContour, Quake } from "@/domain/hazard";
import { hasNeed, statusOf } from "@/domain/center";
import { COUNTRY, MAPCFG, regionByCode, typeStyle } from "@/config";
import { intensityBand } from "@/domain/hazard";
import { clusterPinHtml, glyphSvg } from "@/features/map/pinGlyphs";
import { alertColor, quakePopupHtml, quakeRadius } from "@/features/hazard/quakeMarkers";
import { Icon } from "@/ui/icons";
import { useI18n } from "@/i18n/context";
import type { DictKey } from "@/i18n";

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
export default function MapCanvas({
  centers,
  selectedId,
  onSelect,
  region,
  quakes,
  contours,
  layers,
  draftPin,
  onDraftPinMove,
}: Props) {
  const { t, lang } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const hazardRef = useRef<LayerGroup | null>(null);
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
        center: COUNTRY.geo.center,
        zoom: COUNTRY.geo.zoom,
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
      hazardRef.current = L.layerGroup().addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      layerRef.current = null;
      hazardRef.current = null;
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

  // ── markers ─────────────────────────────────────────────────────────────
  const draw = useCallback(async () => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const L = (await import("leaflet")).default;
    layer.clearLayers();

    const zoom = map.getZoom();
    const clustering = MAPCFG.cluster.enabled && zoom < MAPCFG.cluster.maxZoom;
    // Labels only once the pins have room; below that they overlap into noise.
    const withLabels = zoom >= 14;

    const addPin = (center: Center) => {
      const style = typeStyle(center.type);
      const closed = statusOf(center) === "cerrado";
      const selected = center.id === selectedId;
      const needs = hasNeed(center) && !closed;

      const marker = L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          className: "mkwrap",
          html:
            `<span class="mk${selected ? " mk-on" : ""}${closed ? " mk-closed" : ""}">` +
            `<span class="mkico" style="color:${selected ? "#fff" : style.color}">` +
            `${glyphSvg(style.icon, 12)}</span>` +
            // The heart marks a point that is asking for something right now: the map's
            // whole job is making that visible without a tap.
            (needs ? `<span class="mkn">${heart(selected ? "#fff" : "#c98a2e")}</span>` : "") +
            `</span>`,
          iconSize: [0, 0],
        }),
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
      marker.addTo(layer);
    };

    if (!clustering) {
      for (const c of centers) addPin(c);
      return;
    }

    // Grid cell shrinks as you zoom in, so clusters break apart naturally.
    const cell = 360 / 2 ** (zoom + 3);
    // Grouped by cell AND by type: a mixed cluster would have to pick one colour and
    // would hide that the shelters and the donation points are different answers to
    // different questions.
    const groups = new Map<string, Center[]>();
    for (const c of centers) {
      const key = `${Math.round(c.lat / cell)}:${Math.round(c.lng / cell)}:${c.type}`;
      const list = groups.get(key);
      if (list) list.push(c);
      else groups.set(key, [c]);
    }

    for (const group of groups.values()) {
      const first = group[0];
      if (!first) continue;
      if (group.length === 1) {
        addPin(first);
        continue;
      }
      const lat = group.reduce((a, c) => a + c.lat, 0) / group.length;
      const lng = group.reduce((a, c) => a + c.lng, 0) / group.length;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "mkwrap",
          html: clusterPinHtml(first.type, group.length),
          iconSize: [0, 0],
        }),
        keyboard: false,
        title: first.name,
      });
      marker.on("click", () =>
        map.setView([lat, lng], Math.min(zoom + 3, MAPCFG.tiles.maxZoom)),
      );
      marker.addTo(layer);
    }
  }, [centers, selectedId]);

  useEffect(() => {
    if (!ready) return;
    void draw();
    const map = mapRef.current;
    if (!map) return;
    const handler = () => void draw();
    map.on("zoomend", handler);
    return () => {
      map.off("zoomend", handler);
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
      map.flyTo(COUNTRY.geo.center, COUNTRY.geo.zoom, { duration: 0.6 });
      return;
    }
    const r = regionByCode(region);
    if (r) map.flyTo([r.lat, r.lng], r.zoom ?? COUNTRY.geo.regionZoom, { duration: 0.6 });
  }, [region, ready]);

  // ── centre on the selected point ────────────────────────────────────────
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

