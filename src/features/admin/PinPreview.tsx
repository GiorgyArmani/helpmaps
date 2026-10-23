"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAPCFG } from "@/config";

type At = { lat: number; lng: number };

/**
 * Un mapa chico con el pin, dentro del panel, para el teléfono.
 *
 * A menos de 768px el panel es una hoja que tapa el mapa grande, así que quien aprueba
 * desde el teléfono no veía dónde había quedado el pin. Aquí lo ve y lo corrige: se
 * arrastra el pin o se toca donde va.
 *
 * El mapa NO se arrastra con un dedo: está dentro de un panel que se desplaza, y un mapa
 * que se queda con el gesto atrapa el scroll. Se acerca con dos dedos, y tocar cerca del
 * borde mueve el pin y recentra, así que se llega a cualquier lado.
 */
export default function PinPreview({ at, onMove, label }: { at: At; onMove: (at: At) => void; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const moveRef = useRef(onMove);
  const firstAt = useRef(at);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    moveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current || mapRef.current) return;
      const start = firstAt.current;

      map = L.map(ref.current, {
        center: [start.lat, start.lng],
        zoom: 16,
        zoomControl: false,
        dragging: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
      });
      L.tileLayer(MAPCFG.tiles.url, {
        attribution: MAPCFG.tiles.attribution,
        subdomains: MAPCFG.tiles.subdomains ?? "abc",
        maxZoom: MAPCFG.tiles.maxZoom,
      }).addTo(map);
      map.attributionControl.setPrefix("");

      const pin = L.marker([start.lat, start.lng], {
        draggable: true,
        keyboard: false,
        icon: L.divIcon({ className: "mkwrap", html: `<span class="mkdraft"></span>`, iconSize: [0, 0] }),
      }).addTo(map);
      pin.on("dragend", () => {
        const { lat, lng } = pin.getLatLng();
        map?.panTo([lat, lng]);
        moveRef.current({ lat, lng });
      });
      map.on("click", (e) => {
        pin.setLatLng(e.latlng);
        map?.panTo(e.latlng);
        moveRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
      pinRef.current = pin;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, []);

  // Cuando el pin cambia desde fuera (otro resultado de la búsqueda), el mapa lo sigue.
  useEffect(() => {
    const map = mapRef.current;
    const pin = pinRef.current;
    if (!ready || !map || !pin) return;
    const cur = pin.getLatLng();
    if (Math.abs(cur.lat - at.lat) < 1e-7 && Math.abs(cur.lng - at.lng) < 1e-7) return;
    pin.setLatLng([at.lat, at.lng]);
    map.setView([at.lat, at.lng], Math.max(map.getZoom(), 15));
  }, [at, ready]);

  return (
    <div className={ready ? "pinmap" : "pinmap skel"}>
      <div ref={ref} className="pinmap-map" role="application" aria-label={label} />
    </div>
  );
}
